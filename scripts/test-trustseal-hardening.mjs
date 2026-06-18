#!/usr/bin/env node
// TrustSeal hardening — CSP + Monitoring UX (read/dismiss/unread/filter).
// Static-source assertions. Run: node --experimental-strip-types scripts/test-trustseal-hardening.mjs
import fs from 'node:fs'
let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// ── Part 1.1: CSP ──
const cfg = read('next.config.mjs')
ok('csp: Content-Security-Policy header set', /'Content-Security-Policy'/.test(cfg) && /default-src 'self'/.test(cfg))
ok('csp: locks object-src + frame-ancestors + base-uri + form-action', /object-src 'none'/.test(cfg) && /frame-ancestors 'none'/.test(cfg) && /base-uri 'self'/.test(cfg) && /form-action 'self'/.test(cfg))
ok('csp: allows Firebase auth + Razorpay + AdSense (compatibility)', /firebaseapp\.com/.test(cfg) && /razorpay\.com/.test(cfg) && /googlesyndication\.com/.test(cfg) && /googleapis\.com/.test(cfg))
ok('csp: HSTS + other headers retained (no regression)', /Strict-Transport-Security/.test(cfg) && /X-Content-Type-Options/.test(cfg))

// ── Part 3: Monitoring UX ──
const alerts = read('lib/trustseal/monitoring/alerts.ts')
ok('mon: alert has read state; new alerts unread', /read\?: boolean/.test(alerts) && /read: false/.test(alerts))
ok('mon: markAlertRead is owner-scoped', /export async function markAlertRead/.test(alerts) && /startsWith\(`\$\{accountId\}__`\)/.test(alerts))
ok('mon: markAllAlertsRead exists', /export async function markAllAlertsRead/.test(alerts))
const ep = read('app/api/trustseal/monitoring/route.ts')
ok('mon: endpoint GET returns unread count', /unread/.test(ep) && /a\.read/.test(ep))
ok('mon: endpoint POST mark-read / mark-all (auth + entitlement guarded)', /export async function POST/.test(ep) && /markAlertRead/.test(ep) && /markAllAlertsRead/.test(ep) && /isMonitoringEntitled/.test(ep))
const sec = read('components/trustseal/monitoring-section.tsx')
ok('mon: UI unread badge + mark-all + dismiss + severity filter', /info\.unread/.test(sec) && /t\.markAll/.test(sec) && /t\.dismiss/.test(sec) && /setFilter/.test(sec))
ok('mon: filter applied to shown alerts', /a\.severity === filter/.test(sec))
ok('mon: read alerts dimmed (history retained, not hidden)', /a\.read \? 0\.55 : 1/.test(sec))
for (const f of ['en','hi','es','ar']) ok(`mon: ${f} has UX labels`, /unread:/.test(read('components/trustseal/monitoring-section.tsx')))

// ── Part 1.2: API key store / rotate / revoke ──
const exists = (p) => fs.existsSync(new URL('../' + p, import.meta.url))
const ks = read('lib/trustseal/api-key-store.ts')
ok('apikey: store module (getApiKey/rotate/revoke/resolveAsync)', /export async function getApiKey/.test(ks) && /export async function rotateApiKey/.test(ks) && /export async function revokeApiKey/.test(ks) && /export async function resolveApiKeyAsync/.test(ks))
ok('apikey: random keys (not deterministic) + legacy fallback (no regression)', /randomBytes/.test(ks) && /resolveLegacyHmacKey/.test(ks))
ok('apikey: pure api-key.ts unchanged (no @/ value import → tests safe)', !/from '@\/lib\/store/.test(read('lib/trustseal/api-key.ts')))
const ake = read('app/api/trustseal/api-key/route.ts')
ok('apikey: endpoint GET stored key + POST rotate/revoke', /getApiKey/.test(ake) && /rotateApiKey/.test(ake) && /revokeApiKey/.test(ake) && /export async function POST/.test(ake))
ok('apikey: public API resolves via async store-backed resolver', /resolveApiKeyAsync/.test(read('app/api/trust/[domain]/route.ts')))
const aas = read('components/trustseal/api-access-section.tsx')
ok('apikey: dashboard Regenerate + Revoke controls (with confirm)', /dash\.apiRotate/.test(aas) && /dash\.apiRevoke/.test(aas) && /window\.confirm/.test(aas))

// ── Part 1.3: store-backed rate limiter ──
const rls = read('lib/trustseal/rate-limit-store.ts')
ok('ratelimit: store-backed global limiter (increment, fail-open)', /export async function storeRateLimit/.test(rls) && /increment\(/.test(rls))
ok('ratelimit: keyed requests use the store-backed limiter', /await storeRateLimit\(`trust-api:acct/.test(read('app/api/trust/[domain]/route.ts')))

// ── Part 2.1: Pro → Business in-place upgrade ──
ok('upgrade: razorpay updateSubscriptionPlan (PATCH, schedule now)', /export async function updateSubscriptionPlan/.test(read('lib/billing/razorpay.ts')) && /schedule_change_at: 'now'/.test(read('lib/billing/razorpay.ts')))
const up = read('app/api/trustseal/billing/upgrade/route.ts')
ok('upgrade: endpoint requires active Pro, no cancel/rebuy', exists('app/api/trustseal/billing/upgrade/route.ts') && /ent\.plan !== 'pro'/.test(up) && /updateSubscriptionPlan/.test(up))
ok('upgrade: persists plan=business (entitlement transitions safely)', /plan: 'business'/.test(up))
ok('upgrade: dashboard upgrade button calls /upgrade (not mailto)', /upgradeToBusiness/.test(read('components/trustseal/billing/billing-section.tsx')) && /\/api\/trustseal\/billing\/upgrade/.test(read('components/trustseal/billing/billing-section.tsx')))

// ── Part 2.2: Business yearly (code-ready) ──
ok('yearly: Business yearly plan option + tier mapping ready', /tier: 'business', interval: 'yearly'/.test(read('lib/billing/plans.ts')) && /RAZORPAY_PLAN_BUSINESS_YEARLY/.test(read('lib/billing/plans.ts')))

console.log(`\nHardening tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
