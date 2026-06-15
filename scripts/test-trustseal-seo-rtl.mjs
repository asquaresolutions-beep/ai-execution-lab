#!/usr/bin/env node
// Tests for TrustSeal Phase A4 (SEO/hreflang) + A6 (RTL guardrails + fonts).
// Static-source assertions (modules chain-import locales.ts → not node-loadable;
// tsc + next build cover types/resolution) PLUS a real physical-class guardrail
// that scans the TrustSeal source tree. Run: node scripts/test-trustseal-seo-rtl.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const exists = (p) => fs.existsSync(new URL('../' + p, import.meta.url))
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

// walk *.tsx/*.ts under a dir
function walk(rel) {
  const out = []
  const root = new URL('../' + rel + '/', import.meta.url)
  const rec = (u, base) => {
    for (const e of fs.readdirSync(u, { withFileTypes: true })) {
      if (e.isDirectory()) rec(new URL(e.name + '/', u), base + e.name + '/')
      else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push({ path: base + e.name, src: fs.readFileSync(new URL(e.name, u), 'utf8') })
    }
  }
  rec(root, rel + '/')
  return out
}

// ── A4: SEO / hreflang ──
const seo = read('lib/trustseal/seo.ts')
ok('buildTrustMeta exported', /export function buildTrustMeta/.test(seo))
ok('hreflang covers all locales + x-default', /for \(const l of LOCALES\) languages\[l\]/.test(seo) && /languages\['x-default'\] = abs\(withLocale\(DEFAULT_LOCALE/.test(seo))
ok('canonical helper exported', /export function trustCanonical/.test(seo))
ok('OG locale map has 4 locales', /en: 'en_US'/.test(seo) && /hi: 'hi_IN'/.test(seo) && /es: 'es_ES'/.test(seo) && /ar: 'ar_SA'/.test(seo))
ok('placeholders stay noindex by default', /const index = opts\.index \?\? false/.test(seo) && /index \? undefined : \{ index: false, follow: false \}/.test(seo))
ok('base URL env-overridable', /process\.env\.TRUSTSEAL_BASE_URL/.test(seo))

// every page uses locale-aware generateMetadata via buildTrustMeta
const pages = walk('app/trustseal').filter((f) => f.path.endsWith('/page.tsx'))
// 13 page.tsx files: 11 static + trust/[domain] + legal/[doc] (enterprise hardening).
ok('13 TrustSeal pages present', pages.length === 13)
// Metadata signature varies (locale vs locale: lc; single- vs multi-line args),
// so assert the contract: locale-aware generateMetadata that calls buildTrustMeta.
ok('every page uses generateMetadata + buildTrustMeta', pages.every((p) => /generateMetadata/.test(p.src) && /buildTrustMeta\(/.test(p.src)))

// ── A6: RTL helpers ──
const rtl = read('lib/trustseal/rtl.ts')
ok('isRtlLocale + inlineStart/End helpers', /export function isRtlLocale/.test(rtl) && /export function inlineStart/.test(rtl) && /export function inlineEnd/.test(rtl))
ok('inlineStart rtl→right, inlineEnd rtl→left', /dir === 'rtl' \? 'right' : 'left'/.test(rtl) && /dir === 'rtl' \? 'left' : 'right'/.test(rtl))

// ── A6: fonts ──
const fonts = read('lib/trustseal/fonts.ts')
ok('Arabic + Devanagari Noto faces via next/font', /Noto_Sans_Arabic/.test(fonts) && /Noto_Sans_Devanagari/.test(fonts) && /next\/font\/google/.test(fonts))
ok('subset + display swap (perf budget)', /subsets: \['arabic'\]/.test(fonts) && /subsets: \['devanagari'\]/.test(fonts) && /display: 'swap'/.test(fonts))
ok('localeFontClass maps ar/hi only (en/es Latin)', /locale === 'ar'/.test(fonts) && /locale === 'hi'/.test(fonts) && /return ''/.test(fonts))
const lay = read('app/trustseal/[locale]/layout.tsx')
ok('layout applies localeFontClass + localeFontFamily', /localeFontClass\(locale\)/.test(lay) && /fontFamily: localeFontFamily\(locale\)/.test(lay))
ok('layout STILL sets dir on wrapper, not <html>', /dir=\{dirFor\(locale\)\}/.test(lay) && !/<html/.test(code(lay)))

// ── A6: conventions doc ──
ok('RTL conventions doc present', exists('lib/trustseal/rtl-conventions.md'))

// ── A6 GUARDRAIL: no physical inline-axis classes in the TrustSeal tree ──
const PHYS = /\b(ml|mr|pl|pr)-[0-9.]+|\b(left|right)-[0-9.]+|\b(rounded-[lr]|border-[lr])-/
// The /command surface is an immersive, LTR-only intelligence prototype ("mock
// data, no real intelligence wired") — it is intentionally excluded from the RTL
// inline-axis guardrail. Every customer-facing/localized surface stays covered.
const isCommand = (p) => /\/command\//.test(p) || /command-center|command\/widgets/.test(p)
const tsFiles = [...walk('app/trustseal'), ...walk('components/trustseal')].filter((f) => !isCommand(f.path))
const offenders = tsFiles.filter((f) => PHYS.test(f.src)).map((f) => f.path)
ok(`no physical inline classes in TrustSeal source (${tsFiles.length} files scanned, /command excluded)`, offenders.length === 0)
if (offenders.length) console.error('   offenders:', offenders.join(', '))

// ── guardrail: middleware untouched by this PR's modules ──
ok('A4/A6 modules never reference middleware', !/middleware/i.test(code(seo + rtl + fonts)))

console.log(`\ntrustseal-seo-rtl: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
