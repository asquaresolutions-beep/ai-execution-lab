#!/usr/bin/env node
// Tests for TrustSeal Phase A3 (host-gated middleware, clean URLs). Static-source
// assertions on middleware.ts (edge module; not node-loadable). Locks the routing
// contract + that the ScamCheck branch is untouched + that A2's resolveLocale is reused.
// Run: node scripts/test-trustseal-a3.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const idx = (s, re) => { const m = s.match(re); return m ? m.index : -1 }

const mw = read('middleware.ts')

// ── host branch exists + reuses A2 resolveLocale (no new locale logic) ──
ok('isTrustSealHost matcher present', /function isTrustSealHost/.test(mw) && /trustseal\./.test(mw))
ok('reuses A2 resolveLocale (no new locale logic)', /import \{ resolveLocale \} from '@\/lib\/trustseal\/detect'/.test(mw) && /resolveLocale\(\{/.test(mw))
ok('imports isLocale for segment check', /import \{ isLocale \} from '@\/lib\/trustseal\/locales'/.test(mw))

// ── ordering: TrustSeal branch BEFORE the scamcheck host check ──
const iTrust = idx(mw, /if \(isTrustSealHost\(host\)\)/)
const iScam = idx(mw, /if \(!isScamCheckHost\(host\)\) return NextResponse\.next\(\)/)
ok('TrustSeal branch placed before ScamCheck logic', iTrust > 0 && iScam > iTrust)

// ── behaviour contract ──
ok('root → detect → 307 redirect to /{locale}', /pathname === '\/'/.test(mw) && /pathname = `\/\$\{locale\}`/.test(mw) && /redirect\(url, 307\)/.test(mw))
ok('/{locale}/… → rewrite to /trustseal/{locale}/…', /isLocale\(pathname\.split\('\/'\)\[1\]\)/.test(mw) && /pathname = `\/trustseal\$\{pathname\}`/.test(mw) && /NextResponse\.rewrite\(url\)/.test(mw))
ok('/trustseal/… → 301 redirect to clean URL', /pathname\.startsWith\('\/trustseal\/'\)/.test(mw) && /replace\(\/\^\\\/trustseal\/, ''\)/.test(mw) && /redirect\(url, 301\)/.test(mw))
ok('unknown path on trustseal host → 404', /status: 404/.test(mw))

// ── passthrough list ──
for (const p of ['/_next', '/api', '/favicon', '/robots', '/sitemap', '/guides']) {
  ok(`passthrough includes ${p}`, mw.includes(`'${p}'`))
}
ok('dotted assets pass through', /\\\.\[a-z0-9\]\+\$\/i\.test\(pathname\)/.test(mw) || /\[a-z0-9\]\+\$/.test(mw))

// ── ScamCheck branch INTACT (no regression) ──
ok('scamcheck host check still present', /function isScamCheckHost/.test(mw) && /scamcheck\./.test(mw))
ok('scamcheck root rewrite → /scamcheck intact', /pathname = '\/scamcheck'/.test(mw) && /NextResponse\.rewrite\(url\)/.test(mw))
ok('scamcheck LEGACY_301 + allowlist intact', /LEGACY_301/.test(mw) && /ALLOW_PREFIXES/.test(mw) && /isAllowed\(pathname\)/.test(mw))
ok('lab/other hosts still untouched (next)', /lab\/other hosts untouched/.test(mw) || /isScamCheckHost\(host\)\) return NextResponse\.next/.test(mw))

// ── navigation/detect now clean (public URLs) ──
const nav = read('lib/trustseal/navigation.ts')
ok('navigation builds clean /{locale} public paths', nav.includes('/${locale}${tail}'))
ok('INTERNAL_PREFIX documented but for middleware only', /INTERNAL_PREFIX = '\/trustseal'/.test(nav))
const det = read('lib/trustseal/detect.ts')
ok('localeFromPath matches clean first segment', det.includes('/^\\/([a-z]{2})'))

console.log(`\ntrustseal-a3: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
