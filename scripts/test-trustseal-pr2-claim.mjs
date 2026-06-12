#!/usr/bin/env node
// PR-2 (DNS Claim System) tests. claim-policy.ts is PURE (node:crypto only) → it
// is runtime-tested, including the ownership-stealing regression at the decision
// level. claim.ts + routes chain @/-alias imports the harness can't resolve, so
// their wiring + error-code mapping are static-asserted (next build is the
// integration proof). Run: node --experimental-strip-types scripts/test-trustseal-pr2-claim.mjs
import fs from 'node:fs'
import {
  claimDocId, mintToken, expectedRecords, txtMatches, decideStart, decideVerify,
  TXT_PREFIX, PENDING_TTL_MS,
} from '../lib/trustseal/claim-policy.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// ── token + doc id + records (pure) ───────────────────────────────
ok('claimDocId: deterministic + clm_ prefix', claimDocId('acme.com') === claimDocId('acme.com') && /^clm_[0-9a-f]{32}$/.test(claimDocId('acme.com')))
ok('claimDocId: distinct per domain', claimDocId('acme.com') !== claimDocId('other.com'))
ok('mintToken: 48 hex chars', /^[0-9a-f]{48}$/.test(mintToken()))
ok('mintToken: unique', mintToken() !== mintToken())
const rec = expectedRecords('acme.com', 'TOK')
ok('expectedRecords: value = trustseal-verify=<token>', rec.value === `${TXT_PREFIX}TOK` && rec.value === 'trustseal-verify=TOK')
ok('expectedRecords: primary at apex', rec.primary.type === 'TXT' && rec.primary.name === 'acme.com')
ok('expectedRecords: fallback at _trustseal.<domain>', rec.fallback.name === '_trustseal.acme.com')

// ── TXT matching (pure) ───────────────────────────────────────────
ok('txtMatches: exact match', txtMatches(['trustseal-verify=TOK'], 'TOK'))
ok('txtMatches: trims surrounding whitespace', txtMatches(['  trustseal-verify=TOK  '], 'TOK'))
ok('txtMatches: ignores unrelated TXT', txtMatches(['v=spf1 -all', 'trustseal-verify=TOK'], 'TOK'))
ok('txtMatches: wrong token → false', !txtMatches(['trustseal-verify=NOPE'], 'TOK'))
ok('txtMatches: empty → false', !txtMatches([], 'TOK'))

// ── start decisions (pure) ────────────────────────────────────────
const A = 'uidA', B = 'uidB', now = 1_000_000_000_000
const verifiedByA = { accountId: A, status: 'verified', createdAt: now - 1000, token: 't', verifiedAt: now - 1000 }
const pendingByA = { accountId: A, status: 'pending', createdAt: now - 1000, token: 't' }
ok('decideStart: no existing → new', decideStart(null, A) === 'new')
ok('decideStart: verified by me → already_verified_self', decideStart(verifiedByA, A) === 'already_verified_self')
ok('decideStart: verified by OTHER → already_claimed', decideStart(verifiedByA, B) === 'already_claimed')
ok('decideStart: my pending → reissue', decideStart(pendingByA, A) === 'reissue')
ok('decideStart: pending by other → new (not blocked until verified)', decideStart(pendingByA, B) === 'new')

// ── verify decisions (pure) ───────────────────────────────────────
ok('decideVerify: no existing → no_claim', decideVerify(null, A, now) === 'no_claim')
ok('decideVerify: verified by me → already_verified_self', decideVerify(verifiedByA, A, now) === 'already_verified_self')
ok('decideVerify: pending by other → no_claim', decideVerify(pendingByA, B, now) === 'no_claim')
ok('decideVerify: my fresh pending → check_dns', decideVerify(pendingByA, A, now) === 'check_dns')
ok('decideVerify: my expired pending → expired', decideVerify({ ...pendingByA, createdAt: now - PENDING_TTL_MS - 1 }, A, now) === 'expired')

// ── ⭐ OWNERSHIP-STEALING REGRESSION ──────────────────────────────
// A has verified the domain; B tries to claim/verify the SAME domain → must be 409.
ok('REGRESSION: B start on A-verified domain → already_claimed (→409)', decideStart(verifiedByA, B) === 'already_claimed')
ok('REGRESSION: B verify on A-verified domain → already_claimed (→409)', decideVerify(verifiedByA, B, now) === 'already_claimed')

// ── claim.ts IO wiring + error-code mapping (static) ──────────────
const claim = read('lib/trustseal/claim.ts')
ok('claim: collection is ts_claims', /CLAIMS\s*=\s*'ts_claims'/.test(claim))
ok('claim: already_claimed → 409', /ClaimError\('already_claimed', 409\)/.test(claim))
ok('claim: no_claim → 404', /ClaimError\('no_claim', 404\)/.test(claim))
ok('claim: txt_not_found → 422', /ClaimError\('txt_not_found', 422\)/.test(claim))
ok('claim: token_expired → 410', /ClaimError\('token_expired', 410\)/.test(claim))
ok('claim: invalid_domain → 400', /ClaimError\('invalid_domain', 400\)/.test(claim))
ok('claim: DNS via node:dns resolveTxt', /resolveTxt/.test(claim) && /node:dns\/promises/.test(claim))
ok('claim: apex + _trustseal fallback lookups', /_trustseal\.\$\{domain\}/.test(claim))
ok('claim: canonicalizes via normalizeDomain', /normalizeDomain/.test(claim))
ok('claim: audits verified/failed/start', /'claim\.verified'/.test(claim) && /'claim\.failed'/.test(claim) && /'claim\.start'/.test(claim))
ok('claim: listClaims uses accountId == + orderBy createdAt desc', /field: 'accountId'/.test(claim) && /field: 'createdAt', dir: 'desc'/.test(claim))

// ── audit action union extended ──────────────────────────────────
const audit = read('lib/ai/audit.ts')
ok('audit: claim.* actions added', ['claim.start', 'claim.verified', 'claim.failed', 'claim.revoked'].every((a) => audit.includes(`'${a}'`)))

// ── routes (static) ───────────────────────────────────────────────
const start = read('app/api/trustseal/claim/start/route.ts')
ok('start: POST + auth gate (401) + force-dynamic', /export async function POST/.test(start) && /requireUser\(req\)/.test(start) && /status:\s*401/.test(start) && /'force-dynamic'/.test(start))
ok('start: rate-limited + 429', /enforceRateLimit/.test(start) && /status:\s*429/.test(start))
ok('start: maps ClaimError → e.status', /ClaimError/.test(start) && /status:\s*e\.status/.test(start))
ok('start: returns DNS record instructions', /expectedRecords/.test(start) && /record:\s*rec\.primary/.test(start))

const verify = read('app/api/trustseal/claim/verify/route.ts')
ok('verify: POST + auth + verifyClaim + ClaimError→status', /export async function POST/.test(verify) && /verifyClaim/.test(verify) && /status:\s*e\.status/.test(verify))

const status = read('app/api/trustseal/claim/status/route.ts')
ok('status: GET + auth + getClaim', /export async function GET/.test(status) && /getClaim/.test(status))

const claims = read('app/api/trustseal/claims/route.ts')
ok('claims: GET + auth + listClaims', /export async function GET/.test(claims) && /listClaims/.test(claims))
ok('claims: returns domain/status/method/verifiedAt/createdAt', /domain: c\.domain/.test(claims) && /status: c\.status/.test(claims) && /method: c\.method/.test(claims) && /verifiedAt:/.test(claims) && /createdAt: c\.createdAt/.test(claims))

// ── firestore index added ─────────────────────────────────────────
const idx = JSON.parse(read('firestore.indexes.json'))
const tsClaims = idx.indexes.find((i) => i.collectionGroup === 'ts_claims')
ok('index: ts_claims composite present', !!tsClaims)
ok('index: ts_claims = accountId ASC, createdAt DESC', !!tsClaims &&
  tsClaims.fields[0].fieldPath === 'accountId' && tsClaims.fields[0].order === 'ASCENDING' &&
  tsClaims.fields[1].fieldPath === 'createdAt' && tsClaims.fields[1].order === 'DESCENDING')

console.log(`\nPR-2 claim tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
