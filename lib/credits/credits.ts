// ─────────────────────────────────────────────────────────────────
// lib/credits/credits.ts
// Credit model for ScamCheck scans. Pure + framework-agnostic so it can back a
// client ledger now and a server-enforced ledger later. Guest 3/day, logged-in
// 50/day; screenshot (AI vision) scans cost more than text scans; daily reset.
// NOTE: the client ledger is a soft limit (good enough for v1 freemium);
// server-side enforcement is on the roadmap (user accounts milestone).
// ─────────────────────────────────────────────────────────────────

export type ScanType = 'message' | 'link' | 'email' | 'phone' | 'upi' | 'screenshot'

export const DAILY_QUOTA = { guest: 3, user: 50 } as const
// Screenshot scans run OCR + (gated) Gemini vision → cost more credits.
export const SCAN_COST: Record<ScanType, number> = { message: 1, link: 1, email: 1, phone: 1, upi: 1, screenshot: 3 }

export interface Ledger { day: string; used: number }

/** Local-day key (YYYY-MM-DD) for daily reset. */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function quotaFor(loggedIn: boolean): number {
  return loggedIn ? DAILY_QUOTA.user : DAILY_QUOTA.guest
}

/** Normalize a ledger to today (resets used→0 when the day rolls over). */
export function rollover(ledger: Ledger | null | undefined, today = dayKey()): Ledger {
  if (!ledger || ledger.day !== today) return { day: today, used: 0 }
  return ledger
}

export function remaining(ledger: Ledger | null | undefined, loggedIn: boolean): number {
  const l = rollover(ledger)
  return Math.max(0, quotaFor(loggedIn) - l.used)
}

export function canSpend(ledger: Ledger | null | undefined, type: ScanType, loggedIn: boolean): boolean {
  return remaining(ledger, loggedIn) >= SCAN_COST[type]
}

/** Spend credits for a scan; returns the updated (rolled-over) ledger. */
export function spend(ledger: Ledger | null | undefined, type: ScanType, loggedIn: boolean): { ledger: Ledger; ok: boolean } {
  const l = rollover(ledger)
  const cost = SCAN_COST[type]
  if (quotaFor(loggedIn) - l.used < cost) return { ledger: l, ok: false }
  return { ledger: { day: l.day, used: l.used + cost }, ok: true }
}

/** Next reset time (local midnight) as an ISO string. */
export function nextResetISO(now: Date = new Date()): string {
  const t = new Date(now); t.setHours(24, 0, 0, 0); return t.toISOString()
}
