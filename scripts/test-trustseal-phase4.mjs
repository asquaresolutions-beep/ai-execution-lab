#!/usr/bin/env node
// TrustSeal Phase 4 — API quotas, API keys, usage metering.
// quota.ts + api-key.ts are dependency-light → runtime-tested; the wiring is
// static-asserted. Run: node --experimental-strip-types scripts/test-trustseal-phase4.mjs
import fs from 'node:fs'
import { QUOTAS, quotaFor, usagePeriod } from '../lib/trustseal/quota.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const exists = (p) => fs.existsSync(new URL('../' + p, import.meta.url))

// ── quota tiers (Part 6) ──
for (const p of ['free', 'pro', 'business', 'enterprise']) {
  ok(`quota: '${p}' has rpm + monthly`, QUOTAS[p] && QUOTAS[p].rpm > 0 && QUOTAS[p].monthly > 0)
}
ok('quota: tiers strictly increase (free<pro<business<enterprise)', QUOTAS.free.rpm < QUOTAS.pro.rpm && QUOTAS.pro.rpm < QUOTAS.business.rpm && QUOTAS.business.rpm < QUOTAS.enterprise.rpm)
ok('quota: quotaFor falls back to free for unknown plan', quotaFor('mystery').rpm === QUOTAS.free.rpm && quotaFor(null).monthly === QUOTAS.free.monthly)
ok('quota: usagePeriod is UTC YYYY-MM', /^\d{4}-\d{2}$/.test(usagePeriod(Date.UTC(2026, 5, 15))) && usagePeriod(Date.UTC(2026, 5, 15)) === '2026-06')

// ── API keys: mint/resolve round-trip (Part 6) ──
// api-key.ts reads node:crypto + an env secret; load it with a secret set.
process.env.TRUSTSEAL_SEAL_SECRET = process.env.TRUSTSEAL_SEAL_SECRET || 'test-secret-phase4'
const { mintApiKey, resolveApiKey, apiKeyFromRequest, apiKeysConfigured } = await import('../lib/trustseal/api-key.ts')
ok('apikey: configured when secret present', apiKeysConfigured() === true)
const key = mintApiKey('acct_123')
ok('apikey: mint produces tsk_ key', typeof key === 'string' && key.startsWith('tsk_'))
ok('apikey: deterministic (same account → same key)', mintApiKey('acct_123') === key)
ok('apikey: distinct per account', mintApiKey('acct_999') !== key)
ok('apikey: resolve round-trips to accountId', resolveApiKey(key) === 'acct_123')
// Round-trip MUST hold for ALL account ids — including realistic 28-char Firebase
// uids whose base64url payload/sig may contain '-' or '_' (the original separator bug).
ok('apikey: round-trips for 500 varied account ids (no separator collision)', (() => {
  for (let i = 0; i < 500; i++) {
    const id = 'uid' + i + 'Ab9_x-' + (i * 7919).toString(36) + 'ZqWeRtY'
    const k = mintApiKey(id)
    if (resolveApiKey(k) !== id) return false
  }
  return true
})())
ok('apikey: tampered key rejected', resolveApiKey(key.slice(0, -2) + 'xy') === null)
ok('apikey: garbage rejected', resolveApiKey('tsk_not_valid') === null && resolveApiKey('') === null && resolveApiKey(null) === null)
ok('apikey: from header x-api-key', apiKeyFromRequest(new Request('https://x/api/trust/a.com', { headers: { 'x-api-key': key } })) === key)
ok('apikey: from ?key= query', apiKeyFromRequest(new Request('https://x/api/trust/a.com?key=' + encodeURIComponent(key))) === key)

// ── wiring: public API enforces per-plan quota + meters keyed calls ──
const api = read('app/api/trust/[domain]/route.ts')
ok('api: resolves key → live plan → quota', /resolveApiKey/.test(api) && /getEntitlement/.test(api) && /quotaFor\(plan\)/.test(api))
ok('api: limits keyed by account (or IP when anon)', /acct:\$\{accountId\}/.test(api) && /ip:\$\{clientIp/.test(api))
ok('api: meters keyed calls + X-Plan header', /recordApiUsage\(accountId\)/.test(api) && /'x-plan'/.test(api))
ok('api: keyed responses not CDN-cached (private)', /private, no-store/.test(api))
// Regression guard: responses MUST vary on x-api-key, else the CDN serves the
// cached anonymous Free response to keyed callers (wrong quota, no metering).
ok('api: response varies on x-api-key (CDN correctness)', /'vary':\s*'x-api-key'/.test(api))

// ── authed key endpoint + usage ──
ok('api: /api/trustseal/api-key endpoint exists (authed)', exists('app/api/trustseal/api-key/route.ts') && /requireUser/.test(read('app/api/trustseal/api-key/route.ts')))
ok('usage: metering via store increment, fail-safe', /export async function recordApiUsage/.test(read('lib/trustseal/usage.ts')) && /increment/.test(read('lib/trustseal/usage.ts')))

// ── dashboard surfaces the key + usage ──
const dash = read('components/trustseal/dashboard-client.tsx')
ok('dash: API access section mounted', /<ApiAccessSection locale=\{locale\}/.test(dash))
const apiSec = read('components/trustseal/api-access-section.tsx')
ok('dash: API section fetches the key endpoint + shows usage', /\/api\/trustseal\/api-key/.test(apiSec) && /dash\.apiUsageThisMonth/.test(apiSec))
for (const f of ['en', 'hi', 'es', 'ar']) ok(`i18n: ${f} has apiTitle/apiKey/apiUsage keys`, /apiTitle:/.test(read(`lib/trustseal/messages/${f}.ts`)) && /apiUsageThisMonth:/.test(read(`lib/trustseal/messages/${f}.ts`)))

console.log(`\nPhase-4 tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
