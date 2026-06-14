#!/usr/bin/env node
// TrustSeal — pending-claim removal tests. claim.ts is store/@-bound + node:dns,
// so we static-assert removeClaim's guards, the route, and the dashboard UI;
// next build is the integration proof.
// Run: node --experimental-strip-types scripts/test-trustseal-claim-remove.mjs
import fs from 'node:fs'
let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// ── lib/trustseal/claim.ts: removeClaim guards ────────────────────
const claim = read('lib/trustseal/claim.ts')
ok('claim: exports removeClaim', /export async function removeClaim/.test(claim))
ok('claim: OWNER-ONLY (accountId match, else no_claim 404)', /existing\.accountId !== accountId\) throw new ClaimError\('no_claim', 404\)/.test(claim))
ok('claim: VERIFIED protected (cannot_delete_verified 409)', /existing\.status === 'verified'\) throw new ClaimError\('cannot_delete_verified', 409\)/.test(claim))
ok('claim: HARD delete via store.delete(CLAIMS, id)', /store\.delete\(CLAIMS, id\)/.test(claim))
ok('claim: guards come BEFORE delete (no delete on verified/not-owner)', claim.indexOf("cannot_delete_verified") < claim.indexOf('store.delete(CLAIMS, id)') && claim.indexOf("'no_claim', 404") < claim.indexOf('store.delete(CLAIMS, id)'))
ok('claim: audits claim.removed', /action: 'claim\.removed'/.test(claim))

// ── audit union ───────────────────────────────────────────────────
ok('audit: claim.removed action added', /'claim\.removed'/.test(read('lib/ai/audit.ts')))

// ── route ─────────────────────────────────────────────────────────
const route = read('app/api/trustseal/claim/remove/route.ts')
ok('route: POST + auth (requireUser → 401)', /export async function POST/.test(route) && /requireUser\(req\)/.test(route) && /status: 401/.test(route))
ok('route: calls removeClaim with caller uid', /removeClaim\(domain, user\.uid\)/.test(route))
ok('route: maps ClaimError status (404/409 surfaced)', /e instanceof ClaimError\) return NextResponse\.json\(\{ error: e\.code \}, \{ status: e\.status \}\)/.test(route))
ok('route: requires domain', /domain is required/.test(route))

// ── dashboard UI ──────────────────────────────────────────────────
const ui = read('components/trustseal/claims-list.tsx')
ok('ui: Remove button ONLY on non-verified claims', /c\.status !== 'verified' &&/.test(ui) && /Remove/.test(ui))
ok('ui: confirm() guards accidental deletion', /window\.confirm\(/.test(ui))
ok('ui: calls the remove endpoint with Bearer', /\/api\/trustseal\/claim\/remove/.test(ui) && /Bearer \$\{user\.idToken\}/.test(ui))
ok('ui: reloads after removal', /await load\(\)/.test(ui))

console.log(`\nPending-claim removal tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
