#!/usr/bin/env node
// TrustSeal Conversion pass — social proof, customers page, homepage API + cert
// sections, dashboard upsell. Static-source assertions.
// Run: node --experimental-strip-types scripts/test-trustseal-conversion.mjs
import fs from 'node:fs'
let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const exists = (p) => fs.existsSync(new URL('../' + p, import.meta.url))

// 1. Social proof — richer real stats, zeros hidden
const hd = read('lib/trustseal/home-data.ts')
ok('proof: home-data adds certificates/apiRequests/monitoring stats', /certificatesIssued/.test(hd) && /apiRequestsServed/.test(hd) && /monitoringChecks/.test(hd))
ok('proof: stats are fail-safe (try/catch → 0)', /catch \{ \/\* \*\/ \}/.test(hd) || /apiRequestsServed: 0/.test(hd))
const land = read('components/trustseal/home/landing.tsx')
ok('proof: landing renders the new stats + HIDES zeros', /metrics\.certificatesIssued/.test(land) && /metrics\.apiRequestsServed/.test(land) && /\.filter\(\(c\) => c\.value > 0\)/.test(land))
for (const f of ['en','hi','es','ar']) ok(`proof: ${f} has new metric labels`, /certificatesIssued:/.test(read(`lib/trustseal/messages/${f}.ts`)) && /apiRequestsServed:/.test(read(`lib/trustseal/messages/${f}.ts`)))

// 3. Homepage API section
ok('home: API section (GET /api/trust + JSON + docs link)', /GET \/api\/trust\//.test(land) && /cv\.apiCta/.test(land) && /L\('\/docs'\)/.test(land))
// 4. Homepage Certificate section
ok('home: Certificate section (preview + QR + CTA)', /cv\.certH/.test(land) && /cv\.certQr/.test(land) && /cv\.certCta/.test(land) && /Fingerprint/.test(land))
ok('home: conversion copy localized (en/hi/es/ar)', /CONV: Record<string/.test(land) && /\ben:/.test(land) && /\bhi:/.test(land) && /\bes:/.test(land) && /\bar:/.test(land))

// 2. Customers page — real, indexable, live verified domains
const custRoute = read('app/trustseal/[locale]/customers/page.tsx')
ok('customers: real + indexable (not placeholder)', /CustomersView/.test(custRoute) && /index: true/.test(custRoute) && !/Placeholder/.test(custRoute))
ok('customers: fetches live verified domains', /getRecentVerifications/.test(custRoute))
const custView = read('components/trustseal/home/customers-view.tsx')
ok('customers: verified list + use cases + testimonials framework', /verifiedHeading/.test(custView) && /useCases/.test(custView) && /testimonialsHeading/.test(custView))
ok('customers: no fabricated testimonials (honest framework)', /testimonialsBody/.test(read('lib/trustseal/content/customers.ts')) && /share your story|अपनी कहानी|Comparte tu historia|شارك قصتك/i.test(read('lib/trustseal/content/customers.ts')))
ok('customers: in sitemap', /\/customers/.test(read('app/sitemap.ts')))

// 5. Dashboard upsell — Pro → Business
const bs = read('components/trustseal/billing/billing-section.tsx')
ok('dash: Pro→Business upsell (active Pro, not Business)', /isPro && !isBusiness/.test(bs) && /dash\.proToBusinessTitle/.test(bs) && /dash\.upgradeBusiness/.test(bs))
for (const f of ['en','hi','es','ar']) ok(`dash: ${f} has proToBusiness copy`, /proToBusinessTitle:/.test(read(`lib/trustseal/messages/${f}.ts`)))

// 6. Verify flow conversion (from growth pass) still present
const vv = read('components/trustseal/home/verify-view.tsx')
ok('verify: conversion panel with claim/invite/upgrade', /data-unverified/.test(vv) && /nv\.claim/.test(vv) && /nv\.invite/.test(vv) && /nv\.upgrade/.test(vv))

console.log(`\nConversion tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
