// ─────────────────────────────────────────────────────────────────
// lib/trustseal/usage.ts  (asq-trustseal-phase4)
// Monthly API usage metering per account, via the store's atomic increment.
// Keyed by <accountId>__<period> (UTC month) so each month is its own counter.
// Metering runs ONLY for authenticated (keyed) API calls — anonymous Free calls
// are rate-limited but not metered, which bounds writes (and most anonymous reads
// are CDN-cached anyway). All calls are best-effort: usage must never break the API.
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import { usagePeriod } from '@/lib/trustseal/quota'

const USAGE = 'ts_api_usage'

/** Increment this account's request count for the current month. Returns the new count (or -1 on failure). */
export async function recordApiUsage(accountId: string, now = Date.now()): Promise<number> {
  try {
    return await getStore().increment(USAGE, `${accountId}__${usagePeriod(now)}`, 'count', 1)
  } catch {
    return -1
  }
}

/** Read this account's request count for the current month (0 if none/failure). */
export async function readApiUsage(accountId: string, now = Date.now()): Promise<{ period: string; count: number }> {
  const period = usagePeriod(now)
  try {
    const doc = await getStore().get<{ count: number }>(USAGE, `${accountId}__${period}`)
    return { period, count: doc?.data?.count ?? 0 }
  } catch {
    return { period, count: 0 }
  }
}
