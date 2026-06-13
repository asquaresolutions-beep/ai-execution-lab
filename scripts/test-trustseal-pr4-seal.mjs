#!/usr/bin/env node
// PR-4 (Public Seal Page) tests. seal.ts + the page chain @/-alias imports the
// harness can't resolve, so we static-assert wiring + the security invariants
// (SSRF-free, no auth, verified-only gate) + ISR/metadata config. `next build` is
// the integration proof. Run: node --experimental-strip-types scripts/test-trustseal-pr4-seal.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// ── lib/trustseal/seal.ts — read-only, SSRF-free, no auth ─────────
const seal = read('lib/trustseal/seal.ts')
ok('seal: exports getSealData', /export async function getSealData/.test(seal))
ok('seal: gates on verified ownership claim', /status !== 'verified'/.test(seal) && /return null/.test(seal))
ok('seal: reads ts_claims by doc id (claimDocId)', /ts_claims/.test(seal) && /claimDocId/.test(seal) && /getStore\(\)\.get/.test(seal))
ok('seal: reads verdict via readEnvelope + publicReport (projection)', /readEnvelope/.test(seal) && /publicReport/.test(seal))
// SSRF / auth guards — the security core of PR-4:
ok('SSRF: no node:dns import / resolveTxt call', !/import[^\n]*['"]node:dns/.test(seal) && !/resolveTxt\(/.test(seal))
ok('SSRF: no verify engine (verifyBusiness/getVerification)', !/verifyBusiness/.test(seal) && !/getVerification/.test(seal))
ok('SSRF: no outbound fetch', !/\bfetch\(/.test(seal))
ok('SSRF: does NOT import claim.ts (which pulls node:dns)', !/from '@\/lib\/trustseal\/claim'/.test(seal))
ok('auth: no requireUser / token verification', !/requireUser/.test(seal) && !/verifyFirebaseIdToken/.test(seal) && !/Authorization/.test(seal))
ok('privacy: does not expose accountId/token in SealData', !/accountId:/.test(seal.split('export interface SealData')[1] || ''))

// ── route page ────────────────────────────────────────────────────
const pagePath = 'app/trustseal/[locale]/trust/[domain]/page.tsx'
ok('route: correct location app/trustseal/[locale]/trust/[domain]/page.tsx', fs.existsSync(new URL('../' + pagePath, import.meta.url)))
const page = read(pagePath)
ok('route: fully dynamic (force-dynamic — never ISR-caches a notFound)', /dynamic\s*=\s*'force-dynamic'/.test(page))
ok('route: no ISR revalidate (removed — was the stale-404 cause)', !/revalidate\s*=\s*\d/.test(page))
ok('route: on-demand dynamic params (dynamicParams=true)', /dynamicParams\s*=\s*true/.test(page))
ok('route: 404s unverified domains (notFound)', /notFound\(\)/.test(page) && /if \(!data\) notFound/.test(page))
ok('route: index:true ONLY when verified; noindex otherwise', /index: true/.test(page) && /index: false/.test(page))
ok('route: canonical+hreflang via buildTrustMeta on /trust/<domain>', /buildTrustMeta/.test(page) && /subpath: `\/trust\/\$\{data\.domain\}`/.test(page))
ok('route: no auth (public page)', !/requireUser/.test(page) && !/Authorization/.test(page))
ok('route: decodes domain param', /decodeURIComponent\(domain\)/.test(page))

// ── seal-view (server component, required fields + honest JSON-LD) ─
const view = read('components/trustseal/seal-view.tsx')
ok('view: server component (no use client → SEO-rendered)', !/'use client'/.test(view))
ok('view: shows ownership-verified status', /ownership verified/i.test(view))
ok('view: shows domain name', /data\.domain/.test(view))
ok('view: shows method / verified date / last checked / TrustSeal status', /Verification method/.test(view) && /Verified on/.test(view) && /Last checked/.test(view) && /TrustSeal status/.test(view))
ok('view: business/domain summary when verdict available', /Trust summary/.test(view) && /data\.report/.test(view))
ok('view: JSON-LD Organization + BreadcrumbList', /'@type': 'Organization'/.test(view) && /BreadcrumbList/.test(view))
ok('view: NO fabricated ratings (honest structured data)', !/aggregateRating/i.test(view) && !/"Review"|'Review'/.test(view))

console.log(`\nPR-4 seal tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
