// eval/trustseal-reverify-due.test.mjs
//
// Regression tests for the TrustSeal monitoring "Verification is overdue for
// re-check." (reverify_due) alert.
//
// Bug (Sep 2026): the 90-day expiry check read ts_claims.lastCheckedAt — the
// one-time DNS-ownership check, which monitoring never advances — so a domain that
// was re-verified successfully every day raised the alert (and its email) daily
// from day 90 after its claim onward.
//
// Offline and side-effect free: in-memory store (no STORE_FILE), the network
// re-verification is replaced through the scan's test seam, email is not
// configured, and every fetch is recorded as a violation. All identifiers are fakes.
//
// Run: node --test --import ./eval/hooks.mjs eval/trustseal-reverify-due.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

delete process.env.STORE_FILE
delete process.env.RESEND_API_KEY
delete process.env.FIREBASE_PROJECT_ID
delete process.env.FIREBASE_API_KEY
process.env.LOG_LEVEL = 'info' // so the malformed-history warning is emitted and observable

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const fetchCalls = []
globalThis.fetch = async (url) => { fetchCalls.push(String(url)); return new Response('{}', { status: 500 }) }

const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const { runMonitoringScan } = await imp('lib/trustseal/monitoring/scan.ts')
const { isReverifyOverdue, isTimestamp, resolveExpiryBasis, REVERIFY_DUE_MS } = await imp('lib/trustseal/monitoring/reverify-due.ts')
const { readAlerts } = await imp('lib/trustseal/monitoring/alerts.ts')

const DAY = 86_400_000
const NOW = Date.now() // entitlement is resolved against the real clock, so keep the scan on it too
const UID = 'uid-reverify-test-owner'
const DOMAIN = 'reverify-a.example.test'
const SIGNALS = [{ id: 'ssl.valid', status: 'ok' }, { id: 'dns.resolves', status: 'ok' }, { id: 'dns.mx', status: 'ok' }]

const historyRow = (t, over = {}) => ({
  domain: DOMAIN, verificationId: 'vs_test', checkedAt: t, band: 'established', score: 69, confidence: 1, opacity: false,
  signalSchemaVersion: 'test', weightsVersion: 'test', expiresAt: t + 180 * DAY,
  signals: SIGNALS.map((s) => ({ ...s, category: 'test', value: null })),
  ...over,
})

/** Fresh isolated store: a monitoring-entitled owner with one verified domain + its history. */
async function seed({ verifiedAt, claimLastCheckedAt, historyAt = [] }) {
  const mem = new MemoryStore()
  setStore(mem)
  // Cancelled-at-cycle-end Pro, still inside the paid period (the production shape).
  await mem.set('ts_subscriptions', UID, {
    id: UID, accountId: UID, plan: 'pro', interval: 'yearly', status: 'active', cancelAtCycleEnd: true,
    currentStart: NOW - 100 * DAY, currentEnd: NOW + 265 * DAY, scheduledChange: null,
    razorpayCustomerId: null, razorpaySubscriptionId: null, razorpayPlanId: null, lastEventId: null, lastEventAt: null, updatedAt: NOW - 100 * DAY,
  })
  await mem.set('ts_claims', 'clm_test', {
    id: 'clm_test', domain: DOMAIN, accountId: UID, method: 'dns', token: 'fake-token', status: 'verified',
    createdAt: verifiedAt - 60_000, verifiedAt, lastCheckedAt: claimLastCheckedAt, attempts: 1,
  })
  for (const t of historyAt) await mem.set('ts_verification_history', `vs_test__${t}`, historyRow(t))
  return mem
}

/** Successful re-verification stand-in: appends a history row at `now`, like writeVerification. */
const succeeding = (mem, calls, over = {}) => async (domain, opts) => {
  calls.push({ domain, ...opts })
  await mem.set('ts_verification_history', `vs_test__${opts.now}`, historyRow(opts.now, over))
  return { checkedAt: opts.now }
}

/** Route the scan through a store whose verification-history reads fail (store outage). */
function withUnreadableHistory(mem) {
  const seen = { historyQueries: 0 }
  setStore({
    name: 'memory-history-unreadable',
    set: (c, id, d) => mem.set(c, id, d),
    update: (c, id, p) => mem.update(c, id, p),
    get: (c, id) => mem.get(c, id),
    query: async (c, o) => { if (c === 'ts_verification_history') { seen.historyQueries++; throw new Error('store unavailable') } return mem.query(c, o) },
    delete: (c, id) => mem.delete(c, id),
    increment: (c, id, f, by) => mem.increment(c, id, f, by),
  })
  return seen
}

/** Capture structured console.warn lines emitted during fn. */
async function captureWarnings(fn) {
  const lines = []
  const orig = console.warn
  console.warn = (line) => { lines.push(String(line)) }
  try { await fn() } finally { console.warn = orig }
  return lines.map((l) => { try { return JSON.parse(l) } catch { return { raw: l } } })
}
/** Failed re-verification stand-in (collector/network failure today). */
const failing = (calls) => async (domain, opts) => { calls.push({ domain, ...opts }); throw new Error('collector timeout') }

const reverifyDueAlerts = async () => (await readAlerts(UID)).filter((a) => a.kind === 'reverify_due')

// ── pure rule ──────────────────────────────────────────────────────
test('pure: a current successful verification is never overdue', () => {
  assert.equal(isReverifyOverdue({ lastVerifiedAt: NOW, verifiedAt: NOW - 200 * DAY, now: NOW }), false)
  assert.equal(isReverifyOverdue({ lastVerifiedAt: NOW - 1 * DAY, verifiedAt: NOW - 200 * DAY, now: NOW }), false)
})

test('pure: a genuinely stale successful verification is overdue (strictly after 90 days)', () => {
  assert.equal(isReverifyOverdue({ lastVerifiedAt: NOW - 95 * DAY, verifiedAt: NOW - 200 * DAY, now: NOW }), true)
  assert.equal(isReverifyOverdue({ lastVerifiedAt: NOW - REVERIFY_DUE_MS, verifiedAt: NOW - 200 * DAY, now: NOW }), false)
  assert.equal(isReverifyOverdue({ lastVerifiedAt: NOW - REVERIFY_DUE_MS - 1, verifiedAt: NOW - 200 * DAY, now: NOW }), true)
})

test('pure: ts_claims.lastCheckedAt is not an input — a stale ownership check alone cannot make it overdue', () => {
  // Extra field is ignored by design; only the monitoring timestamp and verifiedAt count.
  assert.equal(isReverifyOverdue({ lastVerifiedAt: NOW - 1 * DAY, verifiedAt: NOW - 120 * DAY, lastCheckedAt: NOW - 120 * DAY, now: NOW }), false)
})

test('pure: fallbacks — no successful verification yet uses verifiedAt; a fresh claim is a floor; unverified is never overdue', () => {
  assert.equal(isReverifyOverdue({ lastVerifiedAt: null, verifiedAt: NOW - 91 * DAY, now: NOW }), true)
  assert.equal(isReverifyOverdue({ lastVerifiedAt: undefined, verifiedAt: NOW - 10 * DAY, now: NOW }), false)
  assert.equal(isReverifyOverdue({ lastVerifiedAt: NOW - 200 * DAY, verifiedAt: NOW - 1 * DAY, now: NOW }), false)
  assert.equal(isReverifyOverdue({ lastVerifiedAt: NOW - 200 * DAY, verifiedAt: null, now: NOW }), false)
})

// ── scan (real runMonitoringScan against the in-memory store) ─────────
test('scan: current successful re-verification → no reverify_due (production shape: claim checked 99.9 days ago)', async () => {
  const claimAt = NOW - Math.round(99.9 * DAY)
  // The fixture reproduces the bug: the pre-fix formula (claim.lastCheckedAt + 90d) says "overdue".
  assert.ok(NOW - claimAt > REVERIFY_DUE_MS)
  const mem = await seed({ verifiedAt: claimAt, claimLastCheckedAt: claimAt, historyAt: [NOW - 2 * DAY, NOW - 1 * DAY] })
  const calls = []
  const res = await runMonitoringScan(NOW, { reverify: succeeding(mem, calls) })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].forceRefresh, true)
  assert.equal(res.reverified, 1)
  assert.deepEqual(await reverifyDueAlerts(), [])
  assert.equal(res.alerts, 0)
})

test('scan: genuinely stale successful verification (re-verify fails today, last success 95 days ago) → one reverify_due', async () => {
  await seed({ verifiedAt: NOW - 200 * DAY, claimLastCheckedAt: NOW - 200 * DAY, historyAt: [NOW - 96 * DAY, NOW - 95 * DAY] })
  const calls = []
  const res = await runMonitoringScan(NOW, { reverify: failing(calls) })
  assert.equal(calls.length, 1)
  assert.equal(res.reverified, 0)
  const alerts = await reverifyDueAlerts()
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].detail, 'Verification is overdue for re-check.')
  assert.equal(alerts[0].severity, 'warning')
  assert.equal((await readAlerts(UID)).length, 1) // no diff alerts on a failed re-verify
})

test('scan: stale ts_claims.lastCheckedAt alone does not trigger when monitoring verification is current (even if today fails)', async () => {
  await seed({ verifiedAt: NOW - 120 * DAY, claimLastCheckedAt: NOW - 120 * DAY, historyAt: [NOW - 2 * DAY] })
  const res = await runMonitoringScan(NOW, { reverify: failing([]) })
  assert.deepEqual(await reverifyDueAlerts(), [])
  assert.equal(res.alerts, 0)
})

test('scan: verified > 90 days with no successful monitoring verification ever → reverify_due', async () => {
  await seed({ verifiedAt: NOW - 91 * DAY, claimLastCheckedAt: NOW - 91 * DAY, historyAt: [] })
  await runMonitoringScan(NOW, { reverify: failing([]) })
  assert.equal((await reverifyDueAlerts()).length, 1)
})

// ── hardening: unknown state, malformed timestamps, diff still fires ──
test('pure: isTimestamp accepts only finite numbers', () => {
  for (const v of [NOW, 0]) assert.equal(isTimestamp(v), true)
  for (const v of [NaN, Infinity, -Infinity, '1758433301000', null, undefined, {}]) assert.equal(isTimestamp(v), false)
})

test('pure: non-finite inputs are never treated as overdue', () => {
  assert.equal(isReverifyOverdue({ lastVerifiedAt: NaN, verifiedAt: NOW - 200 * DAY, now: NOW }), false)
  assert.equal(isReverifyOverdue({ lastVerifiedAt: null, verifiedAt: NaN, now: NOW }), false)
  assert.equal(isReverifyOverdue({ lastVerifiedAt: null, verifiedAt: Infinity, now: NOW }), false)
  assert.equal(isReverifyOverdue({ lastVerifiedAt: NOW - 95 * DAY, verifiedAt: NOW - 200 * DAY, now: NaN }), false)
})

test('pure: resolveExpiryBasis — success is authoritative; failed re-verify needs readable, well-formed history', () => {
  // success this run: known even if history is unreadable or partly malformed
  assert.deepEqual(resolveExpiryBasis(NOW, null), { known: true, lastVerifiedAt: NOW, malformed: 0 })
  assert.deepEqual(resolveExpiryBasis(NOW, [NOW - DAY, 'x']), { known: true, lastVerifiedAt: NOW, malformed: 1 })
  // failed re-verify + unreadable history → unknown
  assert.deepEqual(resolveExpiryBasis(null, null), { known: false, lastVerifiedAt: null, malformed: 0 })
  // failed re-verify + any malformed timestamp → unknown (a bad row could hide the real latest success)
  assert.deepEqual(resolveExpiryBasis(null, [NOW - 95 * DAY, NaN]), { known: false, lastVerifiedAt: null, malformed: 1 })
  assert.deepEqual(resolveExpiryBasis(null, ['corrupt', null]), { known: false, lastVerifiedAt: null, malformed: 2 })
  // failed re-verify + readable, well-formed history → known, latest valid value (order-independent)
  assert.deepEqual(resolveExpiryBasis(null, [NOW - 95 * DAY, NOW - 96 * DAY]), { known: true, lastVerifiedAt: NOW - 95 * DAY, malformed: 0 })
  // failed re-verify + readable empty history → known, none recorded (falls back to verifiedAt)
  assert.deepEqual(resolveExpiryBasis(null, []), { known: true, lastVerifiedAt: null, malformed: 0 })
})

test('scan: re-verify fails AND history unreadable → state unknown, no reverify_due (no fallback to verifiedAt)', async () => {
  const mem = await seed({ verifiedAt: NOW - 200 * DAY, claimLastCheckedAt: NOW - 200 * DAY, historyAt: [NOW - 95 * DAY] })
  const seen = withUnreadableHistory(mem)
  const res = await runMonitoringScan(NOW, { reverify: failing([]) })
  assert.ok(seen.historyQueries >= 1, 'history read was attempted and failed')
  assert.deepEqual(await reverifyDueAlerts(), [])
  assert.equal(res.alerts, 0)
})

test('scan: re-verify succeeds but history unreadable → known (verified now), no reverify_due', async () => {
  const mem = await seed({ verifiedAt: NOW - 200 * DAY, claimLastCheckedAt: NOW - 200 * DAY, historyAt: [NOW - 95 * DAY] })
  withUnreadableHistory(mem)
  const res = await runMonitoringScan(NOW, { reverify: succeeding(mem, []) })
  assert.equal(res.reverified, 1)
  assert.deepEqual(await reverifyDueAlerts(), [])
})

test('scan: malformed history checkedAt + failed re-verify → unknown (no alert) and a structured warning is logged', async () => {
  const mem = await seed({ verifiedAt: NOW - 200 * DAY, claimLastCheckedAt: NOW - 200 * DAY, historyAt: [NOW - 95 * DAY] })
  await mem.set('ts_verification_history', 'vs_test__corrupt', historyRow(0, { checkedAt: 'corrupt' }))
  let res
  const warnings = await captureWarnings(async () => { res = await runMonitoringScan(NOW, { reverify: failing([]) }) })
  assert.deepEqual(await reverifyDueAlerts(), [])
  assert.equal(res.alerts, 0)
  const w = warnings.find((x) => x.event === 'trustseal.monitor.history_checkedAt_malformed')
  assert.ok(w, 'malformed timestamps are reported, not silent')
  assert.equal(w.domain, DOMAIN)
  assert.equal(w.malformed, 1)
})

test('scan: non-finite checkedAt from a successful re-verify falls back to now (never NaN) → no reverify_due', async () => {
  await seed({ verifiedAt: NOW - 200 * DAY, claimLastCheckedAt: NOW - 200 * DAY, historyAt: [NOW - 95 * DAY] })
  // resolves (success) but reports a garbage timestamp and appends no history row
  const res = await runMonitoringScan(NOW, { reverify: async () => ({ checkedAt: NaN }) })
  assert.equal(res.reverified, 1)
  assert.deepEqual(await reverifyDueAlerts(), [])
})

test('scan: successful re-verify with established → caution still raises band_down (diff path intact)', async () => {
  const mem = await seed({ verifiedAt: NOW - 30 * DAY, claimLastCheckedAt: NOW - 30 * DAY, historyAt: [NOW - 1 * DAY] })
  const res = await runMonitoringScan(NOW, { reverify: succeeding(mem, [], { band: 'caution', score: 50 }) })
  const alerts = await readAlerts(UID)
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].kind, 'band_down')
  assert.equal(alerts[0].severity, 'critical')
  assert.equal(alerts[0].from, 'established')
  assert.equal(alerts[0].to, 'caution')
  assert.equal(alerts[0].detail, 'Trust level dropped from established to caution')
  assert.equal(res.alerts, 1)
})

test('offline: no network calls and no email path during the scans', () => {
  assert.deepEqual(fetchCalls, [])
})
