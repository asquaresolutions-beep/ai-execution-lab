// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/ingest.ts
// The scalable ingestion pipeline. Ordered stages, each cheap-fails fast:
//
//   0. rate-limit (per hashed identity)         — abuse protection
//   1. redact PII                               — privacy, always
//   2. spam pre-filter (deterministic)          — drop junk free
//   3. classify (rules -> AI)                   — category + indicators
//   4. embed                                    — vector for dedup/search
//   5. dedup + cluster                          — semantic similarity
//   6. severity score                           — explainable band
//   7. moderation (rules -> AI)                 — display safety
//   8. persist + route (auto-approve | review)  — moderation queue
//
// Designed for fan-out: stages 3/4/7 are independent AI calls and could
// be split into a queue/worker model unchanged (each is idempotent &
// cached). Here they run inline for simplicity.
// ─────────────────────────────────────────────────────────────────

import { getStore, genId } from '@/lib/store/adapter'
import { embed } from '@/lib/ai/embeddings'
import { audit } from '@/lib/ai/audit'
import { enforceRateLimit, RATE_LIMITS, RateLimitError } from '@/lib/ai/rate-limit'
import { classify } from './classify'
import { scoreSeverity, SEVERITY_RANK } from './severity'
import { assessSpam, moderate, redactPII } from './moderation'
import { assignCluster, setClusterSeverity, computeTrend } from './dedup'
import type { RawReport, ScamReport, IngestResult, ReportStatus } from './types'

const REPORTS = 'scam_reports'

export async function ingestReport(raw: RawReport): Promise<IngestResult> {
  const now = raw.submittedAt ?? Date.now()

  // 0. Abuse protection — rate limit per hashed identity.
  const idHash = hashIdentity(raw.ip || raw.reporterContactHint || 'anon')
  try {
    await enforceRateLimit({ key: `ingest:${idHash}`, ...RATE_LIMITS.publicIngest })
  } catch (e) {
    if (e instanceof RateLimitError) {
      return { status: 'blocked', message: 'Rate limit exceeded. Please try again later.' }
    }
    throw e
  }

  // 1. Redact PII immediately — we never store raw contact data.
  const { text } = redactPII(raw.text || '')
  await audit({ action: 'ingest.received', actor: `public:${idHash}`, ok: true, meta: { len: text.length } })

  // 2. Spam pre-filter.
  const spam = assessSpam(text)
  if (spam.isSpam) {
    await audit({ action: 'moderation.flag', actor: 'system', ok: true, message: 'spam', meta: { reasons: spam.reasons } })
    return { status: 'spam', message: 'Report flagged as spam.' }
  }

  // 3. Classification.
  const classification = await classify(text, raw.platform, raw.region)
  await audit({ action: 'ingest.classified', actor: 'system', ok: true, meta: { category: classification.category, confidence: classification.confidence } })

  // 4. Embedding.
  const reportId = genId('rep_')
  const { vector } = await embed(`${classification.summary} ${text}`)

  // 5. Dedup + clustering.
  const match = await assignCluster(vector, classification, reportId, now)
  const isDuplicate = match.decision === 'duplicate'

  // 6. Severity (informed by cluster spread + velocity).
  const velocity = recentVelocity(match.cluster.firstSeen, match.cluster.reportCount, now)
  const severity = scoreSeverity(classification, { reportCount: match.cluster.reportCount, velocity })
  // Escalate cluster severity to the max seen.
  if (SEVERITY_RANK[severity.severity] > SEVERITY_RANK[match.cluster.severity]) {
    await setClusterSeverity(match.cluster.id, severity.severity)
  }

  // 7. Moderation.
  const moderation = await moderate(text)
  if (moderation.verdict === 'block') {
    await audit({ action: 'moderation.decision', actor: 'system', subject: reportId, ok: false, meta: { verdict: 'block', reasons: moderation.reasons } })
    return { status: 'blocked', message: 'Report blocked by moderation.' }
  }

  // 8. Persist + route.
  // Auto-approve only confident, clean, non-duplicate, low/medium reports.
  const autoApprove =
    moderation.verdict === 'allow' &&
    !moderation.containsPII &&
    classification.confidence >= 0.6 &&
    SEVERITY_RANK[severity.severity] <= 3
  const status: ReportStatus = isDuplicate
    ? 'duplicate'
    : autoApprove ? 'approved' : 'pending'

  const report: ScamReport = {
    id: reportId,
    text,
    status,
    category: classification.category,
    classification,
    severity,
    moderation,
    spam,
    clusterId: match.cluster.id,
    isCanonical: match.decision === 'new',
    duplicateOf: isDuplicate ? match.cluster.canonicalReportId : null,
    vector,
    platform: classification.platform,
    region: classification.region,
    createdAt: now,
    updatedAt: now,
    reporterHash: idHash,
    metrics: { reportCount: match.cluster.reportCount },
  }
  await getStore().set(REPORTS, reportId, report as unknown as Record<string, unknown>)

  if (isDuplicate) {
    await audit({ action: 'ingest.duplicate', actor: 'system', subject: reportId, ok: true, meta: { clusterId: match.cluster.id, similarity: match.similarity } })
    return { status: 'duplicate', reportId, clusterId: match.cluster.id, duplicateOf: report.duplicateOf || undefined, classification, severity, message: 'Matched an existing scam pattern; count incremented.' }
  }

  await audit({ action: 'moderation.decision', actor: 'system', subject: reportId, ok: true, meta: { verdict: moderation.verdict, status } })
  return {
    status: status === 'approved' ? 'accepted' : 'queued_for_review',
    reportId, clusterId: match.cluster.id, classification, severity,
    message: status === 'approved' ? 'Report accepted and published to feed.' : 'Report queued for moderator review.',
  }
}

function recentVelocity(firstSeen: number, reportCount: number, now: number): number {
  return computeTrend(reportCount, firstSeen, now)
}

// Stable, non-reversible identity hash (NOT raw PII).
function hashIdentity(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36)
}
