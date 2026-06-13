#!/usr/bin/env node
// PR-5 (Badge Widget) tests. seal-sign.ts is pure (node:crypto) → runtime-tested
// (incl. tamper + domain-binding). The routes chain @/-alias imports → static-
// asserted for anti-forgery + SSRF/CORS/cache/production-safety. `next build` is
// the integration proof.
// Run: TRUSTSEAL_SEAL_SECRET=test-secret node --experimental-strip-types scripts/test-trustseal-pr5-badge.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// ── runtime: seal-sign.ts (set secret BEFORE import so module reads it) ──
process.env.TRUSTSEAL_SEAL_SECRET = 'unit-test-secret-key'
const sign = await import('../lib/trustseal/seal-sign.ts')
const parts = { domain: 'acme.com', status: 'verified', issuedAt: 1781000000000 }
const sig = sign.signSeal(parts)
ok('sign: configured with secret', sign.sealConfigured() === true)
ok('sign: returns v1.<hex>', typeof sig === 'string' && /^v1\.[0-9a-f]{64}$/.test(sig))
ok('sign: verifies its own signature', sign.verifySeal(parts, sig) === true)
ok('sign: rejects tampered domain (domain-bound)', sign.verifySeal({ ...parts, domain: 'evil.com' }, sig) === false)
ok('sign: rejects tampered status', sign.verifySeal({ ...parts, status: 'high_risk' }, sig) === false)
ok('sign: rejects null/empty signature', sign.verifySeal(parts, null) === false && sign.verifySeal(parts, '') === false)
ok('sign: distinct signatures per domain', sign.signSeal(parts) !== sign.signSeal({ ...parts, domain: 'other.com' }))

// ── seal-sign graceful-degradation (static: returns null when no secret) ──
const ss = read('lib/trustseal/seal-sign.ts')
ok('sign: graceful when secret unset (signSeal → null)', /if \(!SECRET\) return null/.test(ss))
ok('sign: constant-time verify', /timingSafeEqual/.test(ss))

// ── status endpoint: SSRF-free, CORS, cache, signature ──
const st = read('app/api/trustseal/seal/[domain]/route.ts')
ok('status: reuses read-only getSealData', /getSealData/.test(st) && /@\/lib\/trustseal\/seal'/.test(st))
ok('SSRF: no engine/dns/auth imports or calls in status route', !/import[^\n]*node:dns/.test(st) && !/verifyBusiness\(|getVerification\(|resolveTxt\(|requireUser\(/.test(st))
ok('status: CORS allow-origin *', /access-control-allow-origin'?: '\*'/.test(st) || /access-control-allow-origin': '\*'/.test(st))
ok('status: OPTIONS preflight handler', /export async function OPTIONS/.test(st))
ok('status: CDN cache s-maxage (scale)', /s-maxage=\d+/.test(st))
ok('status: unverified → { verified: false }', /verified: false/.test(st))
ok('status: signs verified payload', /signSeal\(/.test(st))
ok('status: links to seal page sealUrl', /sealUrl: `\/en\/trust\/\$\{data\.domain\}`/.test(st))

// ── badge loader: anti-forgery + cache + sanitization ──
const bj = read('app/api/trustseal/badge.js/route.ts')
ok('badge: served as JS + CORS + long CDN cache', /application\/javascript/.test(bj) && /Access-Control-Allow-Origin/.test(bj) && /s-maxage=86400/.test(bj))
ok('badge: LIVE status fetch to /api/trustseal/seal/', /\/api\/trustseal\/seal\/'/.test(bj))
ok('badge: ORIGIN-BINDING (sameOrigin host vs domain)', /sameOrigin/.test(bj) && /location\.hostname/.test(bj))
ok('badge: unverified-origin notice path', /unverified origin/.test(bj))
ok('badge: links to seal page /en/trust/', /\/en\/trust\//.test(bj))
ok('badge: sanitizes injected values (esc)', /function esc\(/.test(bj))
ok('badge: no secret leaked into client JS', !/TRUSTSEAL_SEAL_SECRET/.test(bj) && !/signSeal/.test(bj))
ok('badge: self-locates its own script tag', /\/api\/trustseal\/badge\.js/.test(bj) && /currentScript/.test(bj))

// ── scope: no new Firestore collection/index introduced ──
ok('scope: status route adds no new ts_ collection literal', !/'ts_[a-z_]+'/.test(st))

console.log(`\nPR-5 badge tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
