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
for (const lc of ['hi', 'es', 'ar']) {
  ok(`i18n: ${lc}.ts is a typed Messages scaffold`, /: Messages = en/.test(read(`lib/trustseal/messages/${lc}.ts`)))
}

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
