// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/scan-log.ts
// Privacy-light, server-side funnel logging for the ScamCheck embeds + scans.
//
// Writes AGGREGATE COUNTER documents (not per-event rows) through the shared
// production store adapter (Firestore in prod, same path as credits + the scan
// rate-limiter). This makes the blog → embed → scan funnel queryable via
// /api/admin/scan-stats WITHOUT depending on GA4 exports.
//
// Stored: ONLY day + sanitized source slug + event name + integer counts (plus a
// verdict histogram and a risk sum/count for averaging). Never stored: IPs,
// images, user ids, referrer strings — nothing personal.
//
// Every call is best-effort and fully guarded: a logging failure is swallowed so
// it can NEVER break or fail a scan. Callers fire-and-forget (`void logScanEvent`).
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'

export const SCAN_METRICS = 'scan_metrics'

export type ScanEvent = 'embed_view' | 'scan_start' | 'scan_complete'
const EVENTS: readonly ScanEvent[] = ['embed_view', 'scan_start', 'scan_complete']

/** UTC day, e.g. "2026-07-08" — sorts lexicographically for range queries. */
export function metricDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Slug-safe, bounded token. Used for `embed_source` (client-supplied, so also a
 * defensive guard) and `verdict` (server-derived). Falls back to 'unknown' so a
 * missing/garbage value never breaks a doc id or pollutes the collection.
 */
export function slug(s: unknown, fallback = 'unknown'): string {
  if (typeof s !== 'string') return fallback
  const clean = s.slice(0, 64).toLowerCase().replace(/[^a-z0-9._-]/g, '')
  return clean || fallback
}

interface LogOpts {
  embedSource?: unknown
  verdict?: unknown
  riskScore?: unknown
}

/**
 * Increment the counter for one funnel event. Fire-and-forget; never throws.
 * `scan_complete` additionally bumps a verdict histogram and a risk sum/count.
 */
export async function logScanEvent(event: ScanEvent, opts: LogOpts = {}): Promise<void> {
  try {
    if (!EVENTS.includes(event)) return
    const store = getStore()
    const date = metricDay()
    const source = slug(opts.embedSource)

    // Core counter for this event. `update` first guarantees the doc carries the
    // queryable {date, source, event} fields (so the admin range-query finds it),
    // then increment bumps the count.
    const id = `${date}__${source}__${event}`
    await store.update(SCAN_METRICS, id, { date, source, event })
    await store.increment(SCAN_METRICS, id, 'count', 1)

    if (event === 'scan_complete') {
      // Verdict histogram (verdict is server-derived → bounded cardinality).
      const verdict = slug(opts.verdict)
      const vId = `${date}__${source}__verdict__${verdict}`
      await store.update(SCAN_METRICS, vId, { date, source, kind: 'verdict', verdict })
      await store.increment(SCAN_METRICS, vId, 'count', 1)

      // Risk score running sum + n → avg_risk = sum / n.
      const risk = Number(opts.riskScore)
      if (Number.isFinite(risk)) {
        const rId = `${date}__${source}__risk`
        await store.update(SCAN_METRICS, rId, { date, source, kind: 'risk' })
        await store.increment(SCAN_METRICS, rId, 'sum', Math.round(risk))
        await store.increment(SCAN_METRICS, rId, 'n', 1)
      }
    }
  } catch {
    // best-effort: logging must never break a scan or any request
  }
}
