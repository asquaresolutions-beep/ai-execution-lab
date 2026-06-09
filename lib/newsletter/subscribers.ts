// ─────────────────────────────────────────────────────────────────
// lib/newsletter/subscribers.ts
// asq-newsletter-idemp-v1 — pure, dependency-free helpers for newsletter
// idempotency + analytics.
//
// Design notes:
//  • No project (`@/…`) value imports — only `node:crypto` (a builtin). This
//    keeps the module trivially unit-testable under `node --experimental-strip-
//    types` without the Next/webpack path-alias resolver, and side-effect free.
//  • `subscriberDocId()` is a DETERMINISTIC function of the normalized email, so
//    the same address always maps to the same Firestore document id. Combined
//    with a get-before-write check in the route, this guarantees one record per
//    email even under concurrent submits (a racing write overwrites the same id
//    rather than creating a duplicate) — no composite index required.
//
// Rollback: delete this file + its importers (asq-newsletter-idemp-v1).
// ─────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto'

export type Verdict = 'scam' | 'safe' | 'suspicious'
export type VerdictKey = Verdict | 'unknown'
export type DeviceKey = 'mobile' | 'tablet' | 'desktop'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

/** Trim + lowercase. Defensive against undefined. */
export function normalizeEmail(raw?: string): string {
  return (raw || '').trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}

/**
 * Deterministic, collision-safe document id for a subscriber.
 * SHA-1 of the normalized email (no PII in the id itself), `nl_`-prefixed.
 */
export function subscriberDocId(email: string): string {
  const norm = normalizeEmail(email)
  return 'nl_' + createHash('sha1').update(norm).digest('hex').slice(0, 32)
}

/** Map any raw verdict string from the scanner into a stable analytics bucket. */
export function normalizeVerdict(v?: string): VerdictKey {
  if (!v) return 'unknown'
  const s = v.toLowerCase()
  if (/scam|danger|fraud|phish|malicious/.test(s)) return 'scam'
  if (/suspicious|warn|review|unclear|caution|risky/.test(s)) return 'suspicious'
  if (/safe|legit|clean|ok|benign|trusted/.test(s)) return 'safe'
  return 'unknown'
}

/** Clamp a client-reported device hint into a known bucket. */
export function normalizeDevice(d?: string): DeviceKey {
  const s = (d || '').toLowerCase()
  if (s === 'mobile' || s === 'tablet' || s === 'desktop') return s
  return 'desktop'
}

/** Collapse a `source` string to its leading token (strip any `|verdict:…` tail). */
export function normalizeSource(src?: string): string {
  const head = (src || '').split('|')[0].trim().slice(0, 80)
  return head || 'unknown'
}

export interface SubscriberRow {
  verdict?: string
  source?: string
  device?: string
  createdAt?: string
}

export interface NewsletterSummary {
  total: number
  byVerdict: Record<VerdictKey, number>
  bySource: Record<string, number>
  byDevice: Record<DeviceKey, number>
  /** % share of *scan-sourced* subscribers attributable to each verdict (scam+safe+suspicious = 100). */
  conversionByVerdict: Record<Verdict, number>
  scanSourcedTotal: number
  generatedAt: string
}

/** Aggregate raw subscriber rows into dashboard metrics. Pure + deterministic (except generatedAt). */
export function summarizeSubscribers(rows: SubscriberRow[]): NewsletterSummary {
  const byVerdict: Record<VerdictKey, number> = { scam: 0, safe: 0, suspicious: 0, unknown: 0 }
  const byDevice: Record<DeviceKey, number> = { mobile: 0, tablet: 0, desktop: 0 }
  const bySource: Record<string, number> = {}

  for (const r of rows) {
    byVerdict[normalizeVerdict(r.verdict)]++
    byDevice[normalizeDevice(r.device)]++
    const src = normalizeSource(r.source)
    bySource[src] = (bySource[src] || 0) + 1
  }

  const scanSourcedTotal = byVerdict.scam + byVerdict.safe + byVerdict.suspicious
  const pct = (n: number) => (scanSourcedTotal ? Math.round((n / scanSourcedTotal) * 1000) / 10 : 0)

  return {
    total: rows.length,
    byVerdict,
    bySource,
    byDevice,
    conversionByVerdict: { scam: pct(byVerdict.scam), safe: pct(byVerdict.safe), suspicious: pct(byVerdict.suspicious) },
    scanSourcedTotal,
    generatedAt: new Date().toISOString(),
  }
}

// ── Time-series + ranking helpers (dashboard) ──────────────────────
/** YYYY-MM-DD day key (UTC) from an ISO timestamp. */
export function dayKey(iso?: string): string { return (iso || '').slice(0, 10) }

/** ISO-8601 week key, e.g. "2026-W23" (UTC). */
export function isoWeekKey(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso); if (isNaN(+d)) return ''
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3)
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((+t - +first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export interface TrendPoint { key: string; count: number }
export interface RankPoint { key: string; count: number }
export interface SubscriberTrends {
  /** Per-day signups for the last `days` (zero-filled, chronological). */
  daily: TrendPoint[]
  /** Per-ISO-week signups for the last `weeks` (zero-filled, chronological). */
  weekly: TrendPoint[]
  /** Cumulative subscriber total across the daily window (subscribers over time). */
  cumulative: TrendPoint[]
  /** Acquisition sources ranked by signups (top N). */
  topSources: RankPoint[]
  windowDays: number
}

/**
 * Build dashboard time-series from raw rows. Pure + deterministic given `now`
 * (injected for tests). Reuses the same rows as summarizeSubscribers — no extra
 * reads, no new collection.
 */
export function subscriberTrends(rows: SubscriberRow[], now: number = Date.now(), days = 30, weeks = 12): SubscriberTrends {
  const dayCounts = new Map<string, number>()
  const weekCounts = new Map<string, number>()
  const srcCounts = new Map<string, number>()
  for (const r of rows) {
    const d = dayKey(r.createdAt); if (d) dayCounts.set(d, (dayCounts.get(d) || 0) + 1)
    const w = isoWeekKey(r.createdAt); if (w) weekCounts.set(w, (weekCounts.get(w) || 0) + 1)
    const s = normalizeSource(r.source); srcCounts.set(s, (srcCounts.get(s) || 0) + 1)
  }

  // last `days` zero-filled, chronological
  const daily: TrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const k = new Date(now - i * 86400000).toISOString().slice(0, 10)
    daily.push({ key: k, count: dayCounts.get(k) || 0 })
  }
  // cumulative: start from subscribers acquired before the window
  const firstDay = daily[0]?.key || dayKey(new Date(now).toISOString())
  let run = rows.reduce((n, r) => (dayKey(r.createdAt) && dayKey(r.createdAt) < firstDay ? n + 1 : n), 0)
  const cumulative: TrendPoint[] = daily.map((p) => { run += p.count; return { key: p.key, count: run } })

  // last `weeks` distinct ISO weeks, zero-filled, chronological
  const wk: string[] = []
  for (let i = 0; i < weeks; i++) { const k = isoWeekKey(new Date(now - i * 7 * 86400000).toISOString()); if (k && !wk.includes(k)) wk.push(k) }
  const weekly: TrendPoint[] = wk.reverse().map((k) => ({ key: k, count: weekCounts.get(k) || 0 }))

  const topSources: RankPoint[] = [...srcCounts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))

  return { daily, weekly, cumulative, topSources, windowDays: days }
}
