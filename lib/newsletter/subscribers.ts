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
