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

console.log(`\nHardening tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
