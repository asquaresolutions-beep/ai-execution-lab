#!/usr/bin/env node
// Tests for TrustSeal Phase A2 (locale detection/nav/cookie) + A5 (dictionary/t).
// Static-source assertions: the logic modules chain-import locales.ts (extensionless),
// which the node --experimental-strip-types harness can't resolve, so runtime import
// isn't possible here — type + resolution correctness is covered by tsc + next build.
// These assertions lock the *behaviour-defining structure* (cascade order, maps,
// regexes, fallbacks, guardrails) so regressions are caught.
// Run: node scripts/test-trustseal-i18n.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const idx = (s, re) => { const m = s.match(re); return m ? m.index : -1 }
// Strip comments so "no X in code" assertions don't trip on explanatory prose.
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

// ── A2: detect.ts — cascade order + maps + purity ──
const det = read('lib/trustseal/detect.ts')
const iCookie = idx(det, /isLocale\(cookie\)/)
const iPath = idx(det, /localeFromPath\(path\)/)
const iLang = idx(det, /parseAcceptLanguage\(acceptLanguage\)/)
const iGeo = idx(det, /geoSuggestion\(country\)/)
const iDefault = idx(det, /return DEFAULT_LOCALE/)
ok('cascade order: cookie → path → accept-language → geo → default', iCookie > 0 && iCookie < iPath && iPath < iLang && iLang < iGeo && iGeo < iDefault)
ok('geo map: IN→hi, ES→es, SA→ar', /IN:\s*'hi'/.test(det) && /ES:\s*'es'/.test(det) && /SA:\s*'ar'/.test(det))
ok('Accept-Language sorts by q descending', /sort\(\(a, b\) => b\.q - a\.q\)/.test(det))
ok('localeFromPath matches /trustseal/{locale}', /\\\/trustseal\\\/\(\[a-z\]\{2\}\)/.test(det))
ok('detect.ts is pure — no redirect/middleware/NextResponse', !/redirect|NextResponse|middleware/i.test(code(det)))
ok('resolveLocale returns a locale, never navigates', /export function resolveLocale/.test(det) && !/router|navigate|window\.location/.test(code(det)))

// ── A2: navigation.ts — pure href helpers ──
const nav = read('lib/trustseal/navigation.ts')
ok('localizePath swaps the locale segment', /export function localizePath/.test(nav) && /\$\{m\[1\]\}\/\$\{target\}\$\{m\[2\] \?\? ''\}/.test(nav))
ok('withLocale builds /trustseal/{locale}', /\$\{PREFIX\}\/\$\{locale\}/.test(nav))
ok('navigation has no programmatic nav', !/router\.(push|replace)|window\.location/.test(nav))

// ── A2: cookie.ts ──
const ck = read('lib/trustseal/cookie.ts')
ok('cookie name = NEXT_LOCALE', /LOCALE_COOKIE = 'NEXT_LOCALE'/.test(ck))
ok('serialize: Path=/, SameSite=Lax, Max-Age', /Path=\/; Max-Age=.*SameSite=Lax/.test(ck))
ok('writeLocaleCookie is client-guarded (no SSR mutation)', /typeof document === 'undefined'/.test(ck))

// ── A2: switcher — MANUAL only (no auto-navigation) ──
const sw = read('components/trustseal/locale-switcher.tsx')
ok('switcher uses <Link> (manual)', /from 'next\/link'/.test(sw))
ok('switcher has NO programmatic navigation', !/router\.(push|replace)/.test(sw) && !/window\.location/.test(sw))
ok('switcher has NO auto-redirect effect', !/useEffect/.test(sw))
ok('switcher persists cookie on click', /onClick=\{\(\) => writeLocaleCookie\(loc\)\}/.test(sw))

// ── A5: dictionary + accessor ──
const en = read('lib/trustseal/messages/en.ts')
ok('en dict has product + nav strings', /product:\s*'TrustSeal'/.test(en) && /pricing:\s*'Pricing'/.test(en))
ok('en exported as typed const', /export const en = \{/.test(en) && /as const/.test(en) && /export type Messages = typeof en/.test(en))
const mi = read('lib/trustseal/messages/index.ts')
ok('t() falls back: locale → en → raw key', /lookup\(getMessages\(locale\), key\) \?\? lookup\(en, key\) \?\? key/.test(mi))
ok('only en registered (A5 = English only)', /DICTIONARIES: Partial<Record<Locale, Messages>> = \{ en \}/.test(mi))
ok('getMessages falls back to en', /DICTIONARIES\[locale\] \?\? DICTIONARIES\[DEFAULT_LOCALE\]/.test(mi))
ok('next-intl-compatible note documented', /next-intl/i.test(mi))

// ── wiring ──
const lay = read('app/trustseal/[locale]/layout.tsx')
ok('layout renders the switcher', /<LocaleSwitcher current=\{locale\}/.test(lay))
ok('layout uses t() for a label', /t\(locale, 'common\.product'\)/.test(lay))
ok('layout still NOT touching <html> (wrapper dir only)', !/<html/.test(code(lay)) && /dir=\{dirFor\(locale\)\}/.test(lay))

// ── guardrail: no middleware touched in this PR ──
ok('middleware.ts not referenced/edited by A2/A5 files', !/middleware/i.test(code(det + nav + ck + sw)))

console.log(`\ntrustseal-i18n: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
