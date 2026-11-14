// ─────────────────────────────────────────────────────────────────
// lib/email/daily-quota.ts  (asq-shared-daily-quota-v1)
// ONE daily send budget shared by every sender this app can postpone: the welcome
// drip (lib/newsletter/welcome-sequence.ts) and campaign sends (drainCampaign and
// processCampaignSends in lib/newsletter/campaigns.ts). Each of them reads the budget
// afresh immediately before every attempt and stops, without claiming anything, when
// it is used up. A read that fails or is cut short throws: the caller sends nothing.
//
// The provider allows DAILY_PROVIDER_LIMIT emails per UTC day for the whole account.
// ROUTINE_RESERVE of it is kept for mail the app sends on demand and cannot postpone
// (signup welcome, admin notices, lead mail, test sends). What is left is shared:
//
//   remaining = limit − reserve − otherSendsToday − dripAttemptsToday − campaignAttemptsToday
//
//   otherSendsToday        distinct messages with a provider 'sent' or 'suppressed' event
//                          since 00:00 UTC that are NOT attributed to a campaign: on-demand
//                          mail, and the drip's own sends once their events have arrived;
//   dripAttemptsToday      drip attempts claimed since 00:00 UTC − DRIP_CLAIM_LOOKBACK_MS by any run, except those
//                          the provider definitely did not send (failed, deferred, skipped);
//   campaignAttemptsToday  campaign attempts claimed since 00:00 UTC − CAMPAIGN_CLAIM_LOOKBACK_MS,
//                          every one of them (an attempt that ends skipped or refused counts too).
//
// Campaign events are left out of otherSendsToday because no campaign message reaches the
// provider without its claim (campaigns.ts: "no claim, no delivery"), and a claim is made
// at most one run (RUN_LOCK_TTL, 330 s) before its provider call. Counting claims from the
// lookback onwards therefore covers every campaign message the provider can count today,
// including those whose events are late or were never stored (the webhook's store write is
// best-effort). Counting the events as well would count each campaign message twice.
// A drip send is counted twice once its event arrives (drip events carry no attribution):
// that can only make a sender stop early, never late.
//
// What this guarantees: the drip and campaigns together start no attempt once
// otherSendsToday + their own attempts reach limit − reserve. Concurrent runs can each
// make the one attempt they read room for, so the overshoot is at most one attempt per
// run running at the same moment. On-demand mail sent AFTER the last attempt is not
// controlled here: the reserve is what keeps the day under the provider's limit, as long
// as that later mail stays within it.
//
// A reading that fails is logged by its caller (quotaErrorText: error class and message,
// no address), so a persistent failure — which stops every drip and campaign send — is
// visible in the logs and, for the drip, raised as an alert by the daily cron.
//
// Nothing here writes. No environment variable changes any of these numbers.
// ─────────────────────────────────────────────────────────────────
import { getStore } from '@/lib/store/adapter'
import { EMAIL_EVENTS } from './events'
import { WELCOME_SEND_CLAIMS, countProviderSends, utcDayStart, type ProviderEventLike } from '@/lib/newsletter/welcome-claims'

/** The provider's daily allowance for the whole account (free plan: 100 a day, reset at 00:00 UTC). */
export const DAILY_PROVIDER_LIMIT = 100
/** Kept free each day for mail the app sends on demand. */
export const ROUTINE_RESERVE = 40
/** Campaign claims made this long before 00:00 UTC still count today (a run lives at most 330 s). */
export const CAMPAIGN_CLAIM_LOOKBACK_MS = 15 * 60_000
/**
 * Drip claims made this long before 00:00 UTC still count today. A drip claim carries its run's START time and the
 * provider call follows within the run (at most 60 s), so a run that straddles midnight can send in the new day.
 * Claims already sent before midnight are counted too: the guard can stop early, never late.
 */
export const DRIP_CLAIM_LOOKBACK_MS = 5 * 60_000
/** Upper bound on the documents one count reads; reaching it means the count cannot be trusted. */
export const QUOTA_READ_LIMIT = 5_000
/**
 * The campaign attempt ledger. Same value as CAMPAIGN_SEND_CLAIMS in lib/newsletter/campaigns.ts, which imports
 * this module (so it is not imported back); eval/newsletter-daily-quota.test.mjs asserts the two are equal.
 */
export const CAMPAIGN_CLAIMS_COLLECTION = 'campaign_send_claims'

/** Drip claim outcomes that prove the provider did not send: not counted against the day. */
const DRIP_NOT_SENT = new Set(['failed', 'deferred', 'skipped'])

export interface DailyQuotaReading {
  limit: number
  reserve: number
  /** Provider-reported messages today that no campaign claims (see the header). */
  otherSendsToday: number
  dripAttemptsToday: number
  campaignAttemptsToday: number
  /** Attempts the drip and campaigns may still start today. Zero or less: none. */
  remaining: number
}

/** Test seams (the welcome drip's tests set their own limits). Production passes none. */
export interface DailyQuotaOptions {
  limit?: number
  reserve?: number
  readLimit?: number
}

/**
 * Why a reading failed, fit for a log line: the error's name and message, anything shaped like an address
 * removed, cut to 200 characters. The three reads query by time only, so no address is expected; this is a
 * second line of defence. Pure.
 */
export function quotaErrorText(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  return raw.replace(/[^\s<>"'`,;:()[\]]+(?:@|%40)[^\s<>"'`,;:()[\]]+/gi, '[address]').slice(0, 200)
}

/** Provider-reported messages since `dayStartMs` that are not attributed to a campaign. Pure. */
export function countOtherProviderSends(events: readonly ProviderEventLike[], dayStartMs: number): number {
  return countProviderSends(events.filter((e) => !e.campaignId), dayStartMs)
}

/**
 * Read the day's shared budget. Three single-field range reads, made together. Throws when any of
 * them fails or reaches the read limit; callers treat that as "send nothing" (fail closed).
 */
export async function readDailyQuota(now: number = Date.now(), opts: DailyQuotaOptions = {}): Promise<DailyQuotaReading> {
  const limit = opts.limit ?? DAILY_PROVIDER_LIMIT
  const reserve = opts.reserve ?? ROUTINE_RESERVE
  const readLimit = opts.readLimit ?? QUOTA_READ_LIMIT
  const store = getStore()
  const dayStart = utcDayStart(now)
  const [events, dripClaims, campaignClaims] = await Promise.all([
    store.query<ProviderEventLike>(EMAIL_EVENTS, { where: [{ field: 'ts', op: '>=', value: dayStart }], limit: readLimit }),
    store.query<{ outcome?: string | null }>(WELCOME_SEND_CLAIMS, { where: [{ field: 'claimedAtMs', op: '>=', value: dayStart - DRIP_CLAIM_LOOKBACK_MS }], limit: readLimit }),
    store.query<{ claimedAtMs?: number }>(CAMPAIGN_CLAIMS_COLLECTION, { where: [{ field: 'claimedAtMs', op: '>=', value: dayStart - CAMPAIGN_CLAIM_LOOKBACK_MS }], limit: readLimit }),
  ])
  if (events.length >= readLimit || dripClaims.length >= readLimit || campaignClaims.length >= readLimit) throw new Error('quota read truncated')
  const otherSendsToday = countOtherProviderSends(events.map((r) => r.data), dayStart)
  const dripAttemptsToday = dripClaims.filter((c) => !DRIP_NOT_SENT.has(String(c.data.outcome))).length
  const campaignAttemptsToday = campaignClaims.length
  return {
    limit, reserve, otherSendsToday, dripAttemptsToday, campaignAttemptsToday,
    remaining: limit - reserve - otherSendsToday - dripAttemptsToday - campaignAttemptsToday,
  }
}
