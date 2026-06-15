#!/usr/bin/env node
// PR-3 (Claim Wizard UI) tests. These are client React components; the node
// harness can't render them, so — per convention — we static-assert the wiring:
// the five states, the PR-2 API calls, copy-to-clipboard, error mapping, and the
// dashboard integration. `next build` is the compile/integration proof.
// Run: node --experimental-strip-types scripts/test-trustseal-pr3-claim-ui.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// ── claim-wizard.tsx ──────────────────────────────────────────────
const w = read('components/trustseal/claim-wizard.tsx')
ok('wizard: client component', /^'use client'/.test(w))
ok('wizard: reuses useAuth (Bearer idToken)', /useAuth/.test(w) && /Bearer \$\{user\?\.idToken/.test(w))
ok('wizard: 5 states (idle/pending/verifying/verified/error)', ["'idle'", "'pending'", "'verifying'", "'verified'", "'error'"].every((s) => w.includes(s)))
ok('wizard: calls /claim/start', /'\/api\/trustseal\/claim\/start'/.test(w) && /method: 'POST'/.test(w))
ok('wizard: calls /claim/verify', /'\/api\/trustseal\/claim\/verify'/.test(w))
ok('wizard: calls /claim/status', /\/api\/trustseal\/claim\/status\?domain=/.test(w))
ok('wizard: copy-to-clipboard via navigator.clipboard', /navigator\.clipboard\.writeText/.test(w))
ok('wizard: copy TXT name AND value', /copy\('name'/.test(w) && /copy\('value'/.test(w))
// i18n: strings now flow through t(locale, 'dash.*') instead of hardcoded English.
ok('wizard: idle renders domain input + Start claim', /placeholder=\{x\('dash\.domainPlaceholder'\)\}/.test(w) && /x\('dash\.startClaim'\)/.test(w))
ok('wizard: pending shows TXT record name + value rows', /label=\{x\('dash\.nameHost'\)\}/.test(w) && /label=\{x\('dash\.value'\)\}/.test(w))
ok('wizard: verified success state', /dash\.verifiedSuffix/.test(w) && /x\('dash\.verifyAnother'\)/.test(w))
ok('wizard: error mapping for claim codes', ['invalid_domain', 'already_claimed', 'txt_not_found', 'token_expired', 'rate_limited'].every((c) => w.includes(`'${c}'`)))
ok('wizard: surfaces fallback _trustseal record', /fallback/.test(w))
ok('wizard: onVerified callback fired on success', /onVerified\?\.\(\)/.test(w))

// ── claims-list.tsx ───────────────────────────────────────────────
const l = read('components/trustseal/claims-list.tsx')
ok('list: client component', /^'use client'/.test(l))
ok('list: loads from /api/trustseal/claims', /'\/api\/trustseal\/claims'/.test(l))
ok('list: Bearer auth + no-store', /Bearer \$\{user\.idToken\}/.test(l) && /cache: 'no-store'/.test(l))
ok('list: renders domain/status/method/dates', /c\.domain/.test(l) && /c\.status/.test(l) && /c\.method/.test(l) && /c\.createdAt/.test(l) && /c\.verifiedAt/.test(l))
ok('list: reloads on refreshKey', /refreshKey/.test(l) && /\[load, refreshKey\]/.test(l))
ok('list: empty + loading states', /x\('dash\.domainsEmpty'\)/.test(l) && /x\('dash\.loading'\)/.test(l))

// ── dashboard-client.tsx integration ──────────────────────────────
const d = read('components/trustseal/dashboard-client.tsx')
ok('dashboard: imports ClaimWizard + ClaimsList', /import \{ ClaimWizard \}/.test(d) && /import \{ ClaimsList \}/.test(d))
ok('dashboard: renders wizard + list in signed-in view', /<ClaimWizard/.test(d) && /<ClaimsList/.test(d))
ok('dashboard: wizard verify → refresh list', /onVerified=\{\(\) => setClaimsRefresh/.test(d) && /refreshKey=\{claimsRefresh\}/.test(d))
ok('dashboard: still client-only (SSG-safe, no next/headers)', /^'use client'/.test(d) && !/from 'next\/headers'/.test(d))
ok('dashboard: Overview placeholder removed', !/Your domains, badge and billing will appear here/.test(d))

// ── scope guard: no billing / badge / seal IMPLEMENTATION (copy words OK) ──
const all = w + l + d
ok('scope: no billing implementation (razorpay / billing API / subscription calls)',
  !/razorpay|\/api\/trustseal\/billing|createSubscription|loadRazorpay/i.test(all))
ok('scope: no badge-widget / seal-page implementation',
  !/widget\.js|seal\.js|\/api\/trustseal\/seal|\/seal\/\[/i.test(all))

console.log(`\nPR-3 claim-UI tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
