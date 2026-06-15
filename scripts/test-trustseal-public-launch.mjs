#!/usr/bin/env node
// TrustSeal public launch — homepage + i18n + locale detection + licensing tests.
// detect.ts/messages use extension-less relative imports (fine for Next, not node
// strip-types), so we static-assert their wiring; next build is the integration
// proof. Run: node --experimental-strip-types scripts/test-trustseal-public-launch.mjs
import fs from 'node:fs'
let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const exists = (p) => fs.existsSync(new URL('../' + p, import.meta.url))

// ── AUTO LANGUAGE DETECTION: priority cascade + geo map ───────────
const det = read('lib/trustseal/detect.ts')
ok('detect: resolveLocale exists + pure', /export function resolveLocale/.test(det))
ok('detect: priority = cookie → path → accept-language → geo → default', (() => {
  const i = (s) => det.indexOf(s)
  return i('isLocale(cookie)') < i('localeFromPath(path)') && i('localeFromPath(path)') < i('parseAcceptLanguage(acceptLanguage)') && i('parseAcceptLanguage(acceptLanguage)') < i('geoSuggestion(country)')
})())
ok('detect: explicit cookie selection is honored first (not overridden)', /if \(cookie && isLocale\(cookie\)\) return cookie/.test(det))
ok('detect: geo IN → hi', /IN:\s*'hi'/.test(det))
ok('detect: geo Arabic countries → ar', /SA:\s*'ar'/.test(det) && /AE:\s*'ar'/.test(det))
ok('detect: geo Spanish countries → es', /(ES|MX):\s*'es'/.test(det))
ok('detect: default fallback en', /return DEFAULT_LOCALE/.test(det))
ok('detect: parseAcceptLanguage + geoSuggestion building blocks', /export function parseAcceptLanguage/.test(det) && /export function geoSuggestion/.test(det))

// ── i18n: all four locales registered ─────────────────────────────
const idx = read('lib/trustseal/messages/index.ts')
ok('i18n: registers en + hi + es + ar', /DICTIONARIES[^=]*=\s*\{ en, hi, es, ar \}/.test(idx))
ok('i18n: imports hi/es/ar dictionaries', /from '\.\/hi'/.test(idx) && /from '\.\/es'/.test(idx) && /from '\.\/ar'/.test(idx))
ok('i18n: t() with English fallback + raw-key last resort', /export function t/.test(idx) && /lookup\(en, key\) \?\? key/.test(idx))
// Real translations now (typed Messages objects with native scripts/strings).
ok('i18n: hi has real Hindi (Devanagari)', /: Messages = \{/.test(read('lib/trustseal/messages/hi.ts')) && /[ऀ-ॿ]/.test(read('lib/trustseal/messages/hi.ts')))
ok('i18n: es has real Spanish', /: Messages = \{/.test(read('lib/trustseal/messages/es.ts')) && /Verifica cualquier empresa/.test(read('lib/trustseal/messages/es.ts')))
ok('i18n: ar has real Arabic', /: Messages = \{/.test(read('lib/trustseal/messages/ar.ts')) && /[؀-ۿ]/.test(read('lib/trustseal/messages/ar.ts')))

// ── hardening: real metrics/feed (no fabrication), real CTA pages ─
const land2 = read('components/trustseal/home/landing.tsx')
ok('harden: no fabricated metrics in landing', !/12840|5_900_000|5900000/.test(land2))
ok('harden: no fabricated feed domains in landing', !/lure-bank\.top|payquik\.net|orbit\.sh/.test(land2))
ok('harden: metrics+feed come from real props, hidden when empty', /metrics\?: HomeMetrics/.test(land2) && /showMetrics/.test(land2) && /showFeed/.test(land2))
const hd = read('lib/trustseal/home-data.ts')
ok('harden: home-data real store queries, fail-safe', /getStore\(\)\.query/.test(hd) && /value: 'verified'/.test(hd) && /catch/.test(hd))
const hp = read('app/trustseal/[locale]/page.tsx')
ok('harden: homepage fetches real data + ISR', /getHomeMetrics\(\)/.test(hp) && /getRecentVerifications/.test(hp) && /revalidate = 3600/.test(hp))
const pr = read('app/trustseal/[locale]/pricing/page.tsx')
ok('harden: /pricing real + indexable, not placeholder', /PricingView/.test(pr) && /index: true/.test(pr) && !/[Pp]laceholder/.test(pr))
const vp = read('app/trustseal/[locale]/verify/page.tsx')
ok('harden: /verify real + indexable, not placeholder', /VerifyView/.test(vp) && /index: true/.test(vp) && !/[Pp]laceholder/.test(vp))
ok('harden: verify lookup → public seal page', /\/trust\//.test(read('components/trustseal/home/verify-view.tsx')))
ok('harden: pricing/verify views use t() (i18n)', /t\(locale, k\)/.test(read('components/trustseal/home/pricing-view.tsx')) && /t\(locale, k\)/.test(read('components/trustseal/home/verify-view.tsx')))

// ── en dictionary: all homepage namespaces + trust levels ─────────
const en = read('lib/trustseal/messages/en.ts')
for (const ns of ['hero', 'metrics', 'how', 'levels', 'feed', 'network', 'pricing', 'faq', 'cta', 'footer']) {
  ok(`en: namespace '${ns}'`, new RegExp(`\\b${ns}:\\s*\\{`).test(en))
}
for (const lvl of ['verified', 'established', 'limited', 'caution', 'risk']) {
  ok(`en: trust level '${lvl}'`, new RegExp(`${lvl}Name:`).test(en))
}
ok('en: branding strings (company + copyright)', /company: 'A Square Solutions'/.test(en) && /© 2026 A Square Solutions/.test(en))

// ── landing: i18n-driven, band colours, all 10 sections, RTL-safe ──
const land = read('components/trustseal/home/landing.tsx')
ok('landing: client component', /^'use client'/.test(land))
ok('landing: all copy via t() (x = t(locale,...))', /const x = \(k: string\) => t\(locale, k\)/.test(land))
ok('landing: Command Center band colours', /verified: '#34d399'/.test(land) && /established: '#22d3ee'/.test(land) && /limited: '#a78bfa'/.test(land) && /caution: '#fbbf24'/.test(land) && /risk: '#f87171'/.test(land))
for (const m of ['hero.title', 'metrics.heading', 'how.heading', 'levels.heading', 'feed.heading', 'network.heading', 'pricing.heading', 'faq.heading', 'cta.heading', 'footer.tagline']) {
  ok(`landing: renders x('${m}')`, land.includes(`x('${m}')`))
}
ok('landing: animated metric counters', /function Counter/.test(land) && /requestAnimationFrame/.test(land))
ok('landing: branding via keys', land.includes("x('common.copyright')") && land.includes("x('footer.builtBy')"))
ok('landing: RTL-safe (no directional left/right utilities)', !/\b(ml-|mr-|pl-|pr-|left-|right-)\d/.test(land))
ok('landing: no obvious hardcoded marketing sentence', !/Verify any business in seconds/.test(land))

// ── homepage route: indexable + hreflang + no placeholder ─────────
const page = read('app/trustseal/[locale]/page.tsx')
ok('page: indexable', /index: true/.test(page))
ok('page: renders TrustSealLanding', /<TrustSealLanding/.test(page))
ok('page: hreflang/canonical via buildTrustMeta', /buildTrustMeta/.test(page))
ok('page: placeholder removed', !/placeholder/i.test(page))

// ── licensing (repo is public) ────────────────────────────────────
const lic = read('LICENSE.md')
ok('license: © 2026 A Square Solutions', /Copyright © 2026 A Square Solutions/.test(lic))
ok('license: All Rights Reserved', /All Rights Reserved/i.test(lic))
ok('license: source-available, educational/reference', /source-available/i.test(lic) && /educational/i.test(lic))
ok('license: forbids commercial / redistribution / rehost / SaaS clone', /commercial/i.test(lic) && /[Rr]edistribut/.test(lic) && /[Rr]ehost/.test(lic) && /SaaS clon/i.test(lic))
ok('license: NOT MIT/Apache/GPL permissive grant', !/Permission is hereby granted, free of charge/.test(lic) && !/Apache License, Version/.test(lic) && !/GNU GENERAL PUBLIC/.test(lic))
ok('NOTICE present', exists('NOTICE') && /A Square Solutions/.test(read('NOTICE')))
ok('copyright header guidance present', exists('docs/COPYRIGHT_HEADERS.md'))

console.log(`\nPublic-launch tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
