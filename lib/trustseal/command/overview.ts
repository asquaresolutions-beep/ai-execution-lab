// ─────────────────────────────────────────────────────────────────
// lib/trustseal/command/overview.ts
// SERVER-ONLY: assembles the Command Center data for ONE account from the existing
// TrustSeal stores. There is no second source of truth — every value comes from:
//   • listClaims(uid)              ts_claims (accountId == uid)
//   • getSealData(domain)          latest stored verification (verified domains only)
//   • readVerificationHistory      ts_verification_history (per verified domain)
//   • buildTimeline                existing public-timeline derivation
//   • readAlerts(uid)              ts_alerts (accountId == uid)
//   • getEntitlement(uid)          billing entitlement (fail-closed)
//   • certificateId                existing on-demand certificate id
//
// Guarantees (tested in eval/command-overview.test.mjs):
//   • the account is the `uid` passed by the route (from the verified token) — the
//     domain set is derived here from that account's claims, never from input;
//   • read-only: no store writes, no outbound verification, no platform analytics;
//   • the response carries no account ids, emails, tokens, API keys or alert ids.
// ─────────────────────────────────────────────────────────────────
import { listClaims } from '@/lib/trustseal/claim'
import { getSealData } from '@/lib/trustseal/seal'
import { readVerificationHistory, type PublicHistoryRow } from '@/lib/trustseal/verify/persistence'
import { buildTimeline } from '@/lib/trustseal/timeline'
import { readAlerts } from '@/lib/trustseal/monitoring/alerts'
import { getEntitlement } from '@/lib/billing/entitlement'
import { certificateId } from '@/lib/trustseal/certificate'
import { commandMode } from './view-model'
import type { CommandDomain, CommandOverview, CommandRiskSignal, CommandTimelineEvent, CommandVerification } from './types'

export const OVERVIEW_LIMITS = { verifications: 60, timeline: 60, alerts: 50 } as const

/** A signal that needs attention: not collected successfully, or a positive blocklist/impersonation hit. */
export function isRiskSignal(s: { id: string; status: string; value?: unknown }): boolean {
  if (s.status !== 'ok') return true
  return s.value === true && /^(blocklist|impersonation)\./.test(s.id)
}

export async function buildCommandOverview(uid: string, now = Date.now()): Promise<CommandOverview> {
  if (!uid) throw new Error('uid_required')

  const [claims, entitlement, alerts] = await Promise.all([
    listClaims(uid),
    getEntitlement(uid),
    readAlerts(uid, OVERVIEW_LIMITS.alerts),
  ])

  const verifiedClaims = claims.filter((c) => c.status === 'verified' && c.verifiedAt != null)
  const perDomain = await Promise.all(
    verifiedClaims.map(async (c) => {
      const [seal, history] = await Promise.all([
        getSealData(c.domain).catch(() => null),
        readVerificationHistory(c.domain).catch(() => [] as PublicHistoryRow[]),
      ])
      return { domain: c.domain, verifiedAt: c.verifiedAt as number, report: seal?.report ?? null, history }
    }),
  )
  const byDomain = new Map(perDomain.map((d) => [d.domain, d]))

  const domains: CommandDomain[] = claims.map((c) => {
    const d = byDomain.get(c.domain)
    const r = d?.report ?? null
    return {
      domain: c.domain,
      status: c.status,
      method: c.method,
      claimedAt: c.createdAt,
      verifiedAt: c.verifiedAt ?? null,
      report: r
        ? {
            band: r.band,
            score: r.score,
            confidence: r.confidence,
            checkedAt: r.checkedAt,
            partial: r.partial,
            categories: r.categories.map((x) => ({ category: x.category, subScore: x.subScore, covered: x.covered })),
            signals: r.signals.map((s) => ({ id: s.id, category: s.category, status: s.status, ...(s.evidence ? { evidence: s.evidence } : {}) })),
          }
        : null,
      certificate: d ? { id: certificateId(c.domain, d.verifiedAt) } : null,
    }
  })

  const verifications: CommandVerification[] = perDomain
    .flatMap((d) => d.history.map((h) => ({ domain: d.domain, checkedAt: h.checkedAt, band: h.band, score: h.score })))
    .sort((a, b) => b.checkedAt - a.checkedAt)
    .slice(0, OVERVIEW_LIMITS.verifications)

  const riskSignals: CommandRiskSignal[] = perDomain.flatMap((d) =>
    (d.report?.signals ?? [])
      .filter(isRiskSignal)
      .map((s) => ({ domain: d.domain, id: s.id, category: s.category, status: s.status, ...(s.evidence ? { evidence: s.evidence } : {}) })),
  )

  const timeline: CommandTimelineEvent[] = [
    ...claims.map((c) => ({ at: c.createdAt, domain: c.domain, kind: 'claim_started' as const })),
    ...perDomain.flatMap((d) =>
      buildTimeline(d.verifiedAt, d.history).map((e) => ({ at: e.at, domain: d.domain, kind: e.kind, ...(e.from ? { from: e.from } : {}), ...(e.to ? { to: e.to } : {}) })),
    ),
    ...alerts.map((a) => ({ at: a.createdAt, domain: a.domain, kind: 'alert' as const, severity: a.severity, detail: a.detail })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, OVERVIEW_LIMITS.timeline)

  const sev = (k: string) => alerts.filter((a) => a.severity === k).length
  const checked = perDomain.map((d) => d.report?.checkedAt).filter((x): x is number => typeof x === 'number')

  return {
    mode: commandMode(verifiedClaims.length),
    generatedAt: now,
    entitlement: {
      plan: entitlement.plan,
      status: entitlement.status,
      active: entitlement.active,
      inGrace: entitlement.inGrace,
      currentEnd: entitlement.currentEnd,
      monitoring: entitlement.features.monitoring === true,
      maxDomains: entitlement.limits.maxDomains,
    },
    summary: {
      verifiedDomains: verifiedClaims.length,
      pendingClaims: claims.filter((c) => c.status === 'pending').length,
      certificatesAvailable: verifiedClaims.length,
      monitoredDomains: entitlement.features.monitoring === true ? verifiedClaims.length : 0,
      alerts: { total: alerts.length, unread: alerts.filter((a) => !a.read).length, critical: sev('critical'), warning: sev('warning'), info: sev('info') },
      lastCheckedAt: checked.length ? Math.max(...checked) : null,
    },
    domains,
    verifications,
    risk: {
      alerts: alerts.map((a) => ({
        domain: a.domain,
        kind: a.kind,
        severity: a.severity,
        detail: a.detail,
        ...(a.from ? { from: a.from } : {}),
        ...(a.to ? { to: a.to } : {}),
        createdAt: a.createdAt,
        read: a.read === true,
      })),
      signals: riskSignals,
    },
    network: perDomain
      .filter((d) => d.report)
      .map((d) => ({
        domain: d.domain,
        band: d.report!.band,
        score: d.report!.score,
        checkedAt: d.report!.checkedAt,
        categories: d.report!.categories.map((x) => ({ category: x.category, subScore: x.subScore, covered: x.covered })),
      })),
    timeline,
  }
}
