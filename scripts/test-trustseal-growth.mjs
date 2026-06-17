#!/usr/bin/env node
// TrustSeal Growth pass — pricing tiers, sitemap coverage + hreflang, verify
// conversion. Static-source assertions. Run: node --experimental-strip-types scripts/test-trustseal-growth.mjs
import fs from 'node:fs'
let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// ── 1. Revenue loop: pricing tiers ──
const tiers = read('lib/trustseal/content/pricing-tiers.ts')
for (const f of ['en', 'hi', 'es', 'ar']) ok(`pricing: ${f} has business/enterprise/agency tiers`, new RegExp(`\\b${f}:\\s*\\{[\\s\\S]*?business:[\\s\\S]*?enterprise:[\\s\\S]*?agency:`).test(tiers))
ok('pricing: Business is ₹1,999/mo', /₹1,999\/mo/.test(tiers))
ok('pricing: Enterprise + Agency are contact-sales', /Contact sales/.test(tiers))
const pv = read('components/trustseal/home/pricing-view.tsx')
ok('pricing: view renders all four tier cards (Free/Pro + Business/Enterprise)', /pricing\.freeName/.test(pv) && /pricing\.proName/.test(pv) && /tiers\.business/.test(pv) && /tiers\.enterprise/.test(pv))
ok('pricing: Agency tier rendered', /tiers\.agency/.test(pv))
ok('pricing: comparison table adds Monitoring + API rows', /tiers\.rows\.monitoring/.test(pv) && /tiers\.rows\.api/.test(pv) && /Business/.test(pv) && /Enterprise/.test(pv))
ok('pricing: contact-sales CTAs (mailto)', /mailto:\$\{PRICING_CONTACT\}/.test(pv))

// ── 2. SEO discovery: sitemap coverage + hreflang ──
const sm = read('app/sitemap.ts')
ok('sitemap: includes static marketing/authority pages', /\/pricing/.test(sm) && /\/verify/.test(sm) && /\/trust-center/.test(sm) && /\/security/.test(sm) && /\/docs/.test(sm) && /\/about/.test(sm))
ok('sitemap: includes legal pages (LEGAL_SLUGS)', /LEGAL_SLUGS/.test(sm) && /\/legal\//.test(sm))
ok('sitemap: per-locale entries (LOCALES loop)', /for \(const l of LOCALES\)|LOCALES\.map/.test(sm))
ok('sitemap: hreflang alternates + x-default', /alternates: \{ languages:/.test(sm) && /x-default/.test(sm))
ok('sitemap: still lists verified seal pages', /\/en\/trust\/\$\{d\}/.test(sm))

// ── 3. Verify conversion: no 404 dead-end ──
const vv = read('components/trustseal/home/verify-view.tsx')
ok('verify: checks status via the public API before navigating', /\/api\/trust\//.test(vv) && /j\.verified/.test(vv))
ok('verify: unverified shows conversion panel (not 404)', /data-unverified/.test(vv) && /setUnverified/.test(vv))
ok('verify: panel has claim + invite + upgrade CTAs', /nv\.claim/.test(vv) && /nv\.invite/.test(vv) && /nv\.upgrade/.test(vv) && /\/dashboard/.test(vv) && /\/pricing/.test(vv))
ok('verify: invite CTA is a shareable mailto', /inviteHref/.test(vv) && /mailto:/.test(vv))
ok('verify: conversion labels localized (en/hi/es/ar)', /NV_LABELS: Record<Locale/.test(vv) && /\ben:/.test(vv) && /\bhi:/.test(vv) && /\bes:/.test(vv) && /\bar:/.test(vv))
ok('verify: verified still routes to the seal page', /\/\$\{locale\}\/trust\//.test(vv))

console.log(`\nGrowth tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
