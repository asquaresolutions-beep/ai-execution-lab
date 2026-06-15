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
// footer.tagline / branding moved to the standalone TrustSealFooter (layout-level).
for (const m of ['hero.title', 'metrics.heading', 'how.heading', 'levels.heading', 'feed.heading', 'network.heading', 'pricing.heading', 'faq.heading', 'cta.heading']) {
  ok(`landing: renders x('${m}')`, land.includes(`x('${m}')`))
}
ok('landing: animated metric counters', /function Counter/.test(land) && /requestAnimationFrame/.test(land))
ok('landing: footer removed (now provided globally by layout)', !/footer\.builtBy/.test(land))
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

// ── standalone polish pass: lab chrome removed, TrustSeal nav/footer ──
const chrome = read('components/layout/site-chrome.tsx')
ok('chrome: trustseal segment renders NO lab chrome (standalone)', /seg === 'trustseal'/.test(chrome) && /never render the AI Execution Lab chrome/i.test(chrome))
ok('chrome: trustseal branch returns children only (no Sidebar/TopBar)', (() => {
  // Slice the trustseal branch: from its `if` to the next branch (`if (isScamCheckSegment`).
  const start = chrome.indexOf("if (seg === 'trustseal')")
  const end = chrome.indexOf('if (isScamCheckSegment', start)
  if (start < 0 || end < 0) return false
  const branch = chrome.slice(start, end)
  return /return <>\{children\}<\/>/.test(branch) && !/Sidebar|TopBar|EcosystemFooter/.test(branch)
})())
const navc = read('components/trustseal/nav.tsx')
ok('nav: standalone TrustSeal nav exists', /export function TrustSealNav/.test(navc))
ok('nav: product links Verify/Pricing/Security/Docs/About', ["nav.verify","nav.pricing","nav.security","nav.docs","nav.about"].every((k) => navc.includes(`x('${k}')`)))
ok('nav: auth-aware Sign in / Dashboard', /x\('nav\.signIn'\)/.test(navc) && /x\('nav\.dashboard'\)/.test(navc) && /useAuth/.test(navc))
ok('nav: responsive mobile menu', /md:hidden/.test(navc) && /aria-expanded=\{open\}/.test(navc))
ok('nav: no lab nav labels (Start Here/Labs/Playbooks/Failure Archive)', !/Start Here|Failure Archive|Playbooks|Execution Logs/.test(navc))
ok('nav: hidden on immersive /command', /command/.test(navc) && /return null/.test(navc))
const foot = read('components/trustseal/site-footer.tsx')
ok('footer: standalone TrustSeal footer exists', /export function TrustSealFooter/.test(foot))
ok('footer: primary product links', ["nav.pricing","nav.verify","nav.security","nav.docs","nav.about"].every((k) => foot.includes(`x('${k}')`)))
ok('footer: secondary "Built by A Square Solutions"', /x\('footer\.builtBy'\)/.test(foot))
ok('footer: no lab ecosystem as primary nav', !/Start Here|Failure Archive|Playbooks|Tracks|Pathways/.test(foot))

// ── dashboard i18n: every authenticated string via t(locale, 'dash.*') ──
const dashEn = read('lib/trustseal/messages/en.ts')
for (const ns of ['nav', 'dash']) ok(`i18n: en namespace '${ns}'`, new RegExp(`\\b${ns}:\\s*\\{`).test(dashEn))
// The new dash keys must exist in ALL four locales (tsc enforces shape; this
// guards that translators didn't leave them as English copies for the scripts).
const dashKeys = ['kicker','title','domainsTitle','verifyTitle','billingTitle','planLabel','statusLabel','historyLabel','reactivate','cancelSub','remove','startClaim']
for (const f of ['en','hi','es','ar']) {
  const src = read(`lib/trustseal/messages/${f}.ts`)
  ok(`i18n: ${f} has dash namespace + all key set`, /\bdash:\s*\{/.test(src) && dashKeys.every((k) => new RegExp(`${k}:`).test(src)))
}
// non-English locales must actually translate the key dashboard labels (not echo English)
ok('i18n: hi dashboard translated (Devanagari in dash labels)', /domainsTitle: '[^']*[ऀ-ॿ]/.test(read('lib/trustseal/messages/hi.ts')))
ok('i18n: ar dashboard translated (Arabic in dash labels)', /domainsTitle: '[^']*[؀-ۿ]/.test(read('lib/trustseal/messages/ar.ts')))
ok('i18n: es dashboard translated (Spanish, not English "Your domains")', /domainsTitle: 'Tus dominios'/.test(read('lib/trustseal/messages/es.ts')))
// dashboard components thread locale + render via t()
const dc = read('components/trustseal/dashboard-client.tsx')
ok('dash: client threads Locale to wizard/list/billing', /<ClaimWizard locale=\{locale\}/.test(dc) && /<ClaimsList locale=\{locale\}/.test(dc) && /<BillingSection locale=\{locale\}/.test(dc))
for (const comp of ['claim-wizard.tsx','claims-list.tsx','billing/billing-section.tsx']) {
  const src = read(`components/trustseal/${comp}`)
  ok(`dash: ${comp} accepts locale + uses t()`, /locale\??: Locale/.test(src) && /t\(locale/.test(src))
}
ok('dash: auth-button localizable via labels (signOut/greeting)', (() => { const ab = read('components/auth/auth-button.tsx'); return /interface AuthLabels/.test(ab) && /signOut\??: string/.test(ab) && /labels\?: AuthLabels/.test(ab) })())
ok('dash: RTL preserved — layout sets dir from locale', /dir=\{dirFor\(locale\)\}/.test(read('app/trustseal/[locale]/layout.tsx')))

// ── enterprise hardening: SEO entity cleanup (PART 7) ─────────────
const rootLayout = read('app/layout.tsx')
ok('seo: root layout no longer hardcodes ecosystem schema in <head>', !/JSON\.stringify\(websiteSchema\)/.test(rootLayout) && !/JSON\.stringify\(organizationSchema\)/.test(rootLayout))
const tsld = read('lib/trustseal/jsonld.ts')
ok('seo: TrustSeal JSON-LD has Organization/WebSite/Product/SoftwareApplication/FAQPage', ["'Organization'","'WebSite'","'Product'","'SoftwareApplication'","'FAQPage'"].every((tname) => tsld.includes(tname)))
const tsldCode = tsld.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
ok('seo: TrustSeal JSON-LD has NO AI Execution Lab / ScamCheck references', !/AI Execution Lab/.test(tsldCode) && !/ScamCheck/.test(tsldCode))
ok('seo: TrustSeal JSON-LD references parent org A Square Solutions', /parentOrganization/.test(tsld) && /A Square Solutions/.test(tsld))
ok('seo: [locale] layout emits buildTrustSealJsonLd', /buildTrustSealJsonLd\(lc\)/.test(read('app/trustseal/[locale]/layout.tsx')))
ok('seo: ecosystem JSON-LD rendered only on Lab/ScamCheck (SiteChrome), not TrustSeal', /<EcosystemJsonLd \/>/.test(chrome) && (() => { const start = chrome.indexOf("if (seg === 'trustseal')"); const end = chrome.indexOf('if (isScamCheckSegment', start); return !chrome.slice(start, end).includes('EcosystemJsonLd') })())

// ── enterprise hardening: legal framework (PARTs 1/2/3/14) ────────
for (const f of ['LICENSE.md','TRADEMARKS.md','COPYRIGHT.md','SECURITY.md','CODE_OF_CONDUCT.md','NOTICE.md']) {
  ok(`legal: ${f} present + © A Square Solutions`, exists(f) && /A Square Solutions/.test(read(f)))
}
const legalContent = read('lib/trustseal/legal-content.ts')
for (const slug of ['license','trademark-policy','copyright','security','code-of-conduct','privacy','terms','acceptable-use','dmca']) {
  ok(`legal: doc '${slug}' defined`, new RegExp(`'?${slug}'?:`).test(legalContent) || legalContent.includes(`'${slug}'`))
}
ok('legal: license forbids clone/resell/compete/rebrand', /clone/i.test(legalContent) && /resell|redistribute/i.test(legalContent) && /competing|SaaS/i.test(legalContent))
ok('legal: contact is contact@asquaresolution.com', /contact@asquaresolution\.com/.test(legalContent))
ok('legal: /legal/[doc] route exists + indexable + static params', (() => { const r = read('app/trustseal/[locale]/legal/[doc]/page.tsx'); return /generateStaticParams/.test(r) && /index: true/.test(r) })())

// ── enterprise hardening: real Security/Docs/About (PARTs 4/5/6) ──
for (const [page, file] of [['security','security'],['docs','docs'],['about','about']]) {
  const route = read(`app/trustseal/[locale]/${page}/page.tsx`)
  ok(`content: /${page} is real (ContentPageView) + indexable, not placeholder`, /ContentPageView/.test(route) && /index: true/.test(route) && !/Placeholder/.test(route))
  const content = read(`lib/trustseal/content/${file}.ts`)
  ok(`content: ${file} content has all 4 locales`, /\ben:\s*\{/.test(content) && /\bhi:\s*\{/.test(content) && /\bes:\s*\{/.test(content) && /\bar:\s*\{/.test(content))
}

// ── enterprise hardening: date + auth localization (PARTs 11/12) ──
const fmt = read('lib/trustseal/format.ts')
ok('i18n: locale-aware formatDate util (Intl.DateTimeFormat)', /export function formatDate/.test(fmt) && /Intl\.DateTimeFormat/.test(fmt))
for (const comp of ['claims-list.tsx','billing/billing-section.tsx','seal-view.tsx']) {
  const src = read(`components/trustseal/${comp}`)
  ok(`i18n: ${comp} uses formatDate (not raw toLocaleDateString)`, /formatDate\(/.test(src) && !/toLocaleDateString/.test(src))
}
const ab = read('components/auth/auth-button.tsx')
ok('i18n: auth-button modal strings localizable (Google/email/password/createAccount)', ['continueGoogle','email','password','createAccount'].every((k) => ab.includes(k)))

// ── enterprise hardening: footer + badge (PARTs 13/8) ─────────────
const footer = read('components/trustseal/site-footer.tsx')
ok('footer: legal + contact links (privacy/terms/security/trademark/dmca/contact)', ['legal.privacy','legal.terms','legal.security','legal.trademark','legal.dmca'].every((k) => footer.includes(k)) && /mailto:contact@asquaresolution\.com/.test(footer))
ok('badge: root /badge.js alias route exists', exists('app/badge.js/route.ts'))
ok('badge: loader self-locates via /badge.js (works at both paths)', /indexOf\('\/badge\.js'\)/.test(read('app/api/trustseal/badge.js/route.ts')))

console.log(`\nPublic-launch tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
