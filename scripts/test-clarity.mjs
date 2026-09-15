#!/usr/bin/env node
// Tests for the Microsoft Clarity integration (TrustSeal / ScamCheck / Lab hosts).
// lib/analytics/clarity.ts has no imports, so it loads directly; wiring, CSP and masking
// are static source assertions like the other suites. Run: node scripts/test-clarity.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const { CLARITY_TAGS, CONSENT_STORAGE_KEY, clarityTagFor, parseStoredConsent, clarityConsentFrom } = await import('../lib/analytics/clarity.ts')
const PROD = { nodeEnv: 'production', vercelEnv: 'production' }

// ── hostname → project (exact allowlist) ─────────────────────────────
ok('trustseal host → TrustSeal tag', clarityTagFor('trustseal.asquaresolution.com', '/en', PROD) === 'yiorq9r173')
ok('scamcheck host → ScamCheck tag', clarityTagFor('scamcheck.asquaresolution.com', '/', PROD) === 'yisc9590xj')
ok('lab host → Lab tag', clarityTagFor('lab.asquaresolution.com', '/', PROD) === 'yiscisont7')
ok('lab host serving /trustseal/en → still the Lab tag', clarityTagFor('lab.asquaresolution.com', '/trustseal/en', PROD) === 'yiscisont7')
ok('lab host serving a ScamCheck route → still the Lab tag', clarityTagFor('lab.asquaresolution.com', '/scamcheck', PROD) === 'yiscisont7')
ok('trustseal host on /scam-intelligence → TrustSeal tag (host, not path)', clarityTagFor('trustseal.asquaresolution.com', '/scam-intelligence', PROD) === 'yiorq9r173')
ok('exactly three hosts mapped', Object.keys(CLARITY_TAGS).length === 3)
ok('tag map is frozen', Object.isFrozen(CLARITY_TAGS))
for (const h of [
  'asquaresolution.com', 'www.asquaresolution.com', 'ai-execution-lab-three.vercel.app',
  'ai-execution-ojzos45f3-a-square-solutions-projects.vercel.app', 'ai-execution-lab-git-master-a-square-solutions-projects.vercel.app',
  'localhost', '127.0.0.1', 'staging.asquaresolution.com', 'evil-trustseal.asquaresolution.com',
  'trustseal.asquaresolution.com.evil.com', 'lab.asquaresolution.com.', 'toString', 'constructor', '__proto__', '',
]) ok(`no Clarity on host ${JSON.stringify(h)}`, clarityTagFor(h, '/', PROD) === null)

// ── production only ──────────────────────────────────────────────────
ok('no Clarity in development', clarityTagFor('lab.asquaresolution.com', '/', { nodeEnv: 'development' }) === null)
ok('no Clarity in test', clarityTagFor('lab.asquaresolution.com', '/', { nodeEnv: 'test' }) === null)
ok('no Clarity on Vercel preview env', clarityTagFor('lab.asquaresolution.com', '/', { nodeEnv: 'production', vercelEnv: 'preview' }) === null)
ok('no Clarity on Vercel development env', clarityTagFor('lab.asquaresolution.com', '/', { nodeEnv: 'production', vercelEnv: 'development' }) === null)
ok('production build without VERCEL_ENV still host-gated', clarityTagFor('lab.asquaresolution.com', '/', { nodeEnv: 'production' }) === 'yiscisont7' && clarityTagFor('localhost', '/', { nodeEnv: 'production' }) === null)

// ── embed exclusion ──────────────────────────────────────────────────
ok('no Clarity on /embed/checker', clarityTagFor('scamcheck.asquaresolution.com', '/embed/checker', PROD) === null)
ok('no Clarity on /embed', clarityTagFor('scamcheck.asquaresolution.com', '/embed', PROD) === null)
ok('no Clarity on /embed/* on any host', clarityTagFor('lab.asquaresolution.com', '/embed/checker', PROD) === null)
ok('/embedded-guide is not treated as an embed', clarityTagFor('lab.asquaresolution.com', '/embedded-guide', PROD) === 'yiscisont7')

// ── consent mapping (matches the banner's stored shape) ─────────────
ok('consent key matches banner', CONSENT_STORAGE_KEY === 'sc-consent-v1' && /const KEY = 'sc-consent-v1'/.test(read('components/consent/consent-banner.tsx')))
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
ok('no stored choice → denied/denied', eq(clarityConsentFrom(null), { ad_Storage: 'denied', analytics_Storage: 'denied' }))
ok('Accept all → granted/granted', eq(clarityConsentFrom(parseStoredConsent('{"analytics":true,"ads":true,"ts":1}')), { ad_Storage: 'granted', analytics_Storage: 'granted' }))
ok('Reject non-essential → denied/denied', eq(clarityConsentFrom(parseStoredConsent('{"analytics":false,"ads":false,"ts":1}')), { ad_Storage: 'denied', analytics_Storage: 'denied' }))
ok('Customize analytics only', eq(clarityConsentFrom(parseStoredConsent('{"analytics":true,"ads":false}')), { ad_Storage: 'denied', analytics_Storage: 'granted' }))
ok('Customize ads only', eq(clarityConsentFrom(parseStoredConsent('{"analytics":false,"ads":true}')), { ad_Storage: 'granted', analytics_Storage: 'denied' }))
ok('malformed storage → null → denied', parseStoredConsent('not json') === null && eq(clarityConsentFrom(parseStoredConsent('not json')), { ad_Storage: 'denied', analytics_Storage: 'denied' }))
ok('non-boolean values never grant', eq(clarityConsentFrom(parseStoredConsent('{"analytics":"yes","ads":1}')), { ad_Storage: 'denied', analytics_Storage: 'denied' }))
ok('JSON null → null', parseStoredConsent('null') === null)

// ── component wiring ─────────────────────────────────────────────────
const comp = code(read('components/analytics/clarity.tsx'))
ok('component is a client component', /^'use client'/.test(read('components/analytics/clarity.tsx')))
ok('component uses browser hostname + pathname', /window\.location\.hostname/.test(comp) && /window\.location\.pathname/.test(comp))
ok('component passes NODE_ENV + NEXT_PUBLIC_VERCEL_ENV', /process\.env\.NODE_ENV/.test(comp) && /process\.env\.NEXT_PUBLIC_VERCEL_ENV/.test(comp))
ok('component guards against duplicate injection', /document\.getElementById\(SCRIPT_ID\)/.test(comp))
// raw source: the comment stripper would cut the "https://" URL literal
ok('component loads the tag async from www.clarity.ms', /script\.async = true/.test(comp) && /script\.src = `https:\/\/www\.clarity\.ms\/tag\/\$\{tag\}`/.test(read('components/analytics/clarity.tsx')))
ok('consentv2 is queued before the tag script is appended', comp.indexOf("'consentv2'") > 0 && comp.indexOf("'consentv2'", comp.indexOf('export function Clarity')) < comp.indexOf('appendChild'))
ok('effect runs once (empty deps)', /\},\s*\[\]\)/.test(comp))
ok('no deprecated Consent API v1 anywhere', !/clarity\(\s*['"]consent['"]/.test(comp) && !/clarity\(\s*['"]consent['"]/.test(code(read('components/consent/consent-banner.tsx'))))
const layout = code(read('app/layout.tsx'))
ok('layout mounts <Clarity /> exactly once', (layout.match(/<Clarity\s*\/>/g) || []).length === 1)
ok('layout does not read headers()', !/headers\(\)/.test(layout))
ok('Vercel Analytics still mounted', /<VercelAnalytics\s*\/>/.test(layout) && /<Analytics\s*\/>/.test(layout) && /<ConsentBanner\s*\/>/.test(layout))
ok('Web Vitals reporter not reintroduced', !/WebVitals/.test(layout) && !fs.existsSync(new URL('../components/analytics/web-vitals.tsx', import.meta.url)))
const banner = code(read('components/consent/consent-banner.tsx'))
ok('banner forwards every saved choice to Clarity', /function apply\(prefs: Prefs\)[\s\S]*setClarityConsent\(prefs\)/.test(banner))
ok('banner still updates Google Consent Mode', /g\('consent', 'update'/.test(banner) && /analytics_storage: prefs\.analytics \? 'granted' : 'denied'/.test(banner))

// ── single source of truth / no duplicates ───────────────────────────
const walk = (rel, out = []) => { for (const e of fs.readdirSync(new URL('../' + rel + '/', import.meta.url), { withFileTypes: true })) { const p = rel + '/' + e.name; if (e.isDirectory()) walk(p, out); else if (/\.(tsx?|mjs|js)$/.test(e.name)) out.push(p) } return out }
const src = [...walk('app'), ...walk('components'), ...walk('lib'), 'middleware.ts']
ok('clarity.ms/tag referenced only by the Clarity component', src.filter((p) => /clarity\.ms\/tag/.test(read(p))).join(',') === 'components/analytics/clarity.tsx')
for (const id of ['yiorq9r173', 'yisc9590xj', 'yiscisont7']) ok(`tag ${id} defined only in lib/analytics/clarity.ts`, src.filter((p) => read(p).includes(id)).join(',') === 'lib/analytics/clarity.ts')
ok('WordPress/GTM Clarity id is not used in this app', src.every((p) => !read(p).includes('yisbvof8lf')))
ok('middleware untouched by Clarity', !/clarity/i.test(read('middleware.ts')))

// ── CSP: additive only ───────────────────────────────────────────────
const cfg = read('next.config.mjs')
const directive = (name) => (cfg.match(new RegExp(`"${name} ([^"]+)"`)) || [])[1] || ''
const scriptSrc = directive('script-src'), connectSrc = directive('connect-src')
ok('script-src allows *.clarity.ms', scriptSrc.split(' ').includes('https://*.clarity.ms'))
ok('connect-src allows *.clarity.ms and c.bing.com', connectSrc.split(' ').includes('https://*.clarity.ms') && connectSrc.split(' ').includes('https://c.bing.com'))
ok('script-src keeps Google sign-in, Razorpay, GA, AdSense, Plausible, Vercel', ['https://accounts.google.com', 'https://apis.google.com', 'https://checkout.razorpay.com', 'https://*.razorpay.com', 'https://*.googletagmanager.com', 'https://*.google-analytics.com', 'https://pagead2.googlesyndication.com', 'https://plausible.io', 'https://va.vercel-scripts.com'].every((d) => scriptSrc.split(' ').includes(d)))
ok('connect-src keeps auth, Razorpay, GA, Plausible, Vercel', ['https://accounts.google.com', 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://api.razorpay.com', 'https://*.google-analytics.com', 'https://plausible.io', 'https://*.vercel-insights.com'].every((d) => connectSrc.split(' ').includes(d)))
ok('no wildcard source added', !/(^| )(\*|https:|https:\/\/\*)( |$)/.test(scriptSrc) && !/(^| )(\*|https:|https:\/\/\*)( |$)/.test(connectSrc))
ok('lockdown directives preserved', ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].every((d) => cfg.includes(d)))
ok('embed CSP still derived from the main CSP', /const embedCsp = csp\.replace\(/.test(cfg))

// ── privacy masking ──────────────────────────────────────────────────
const mask = /data-clarity-mask="True"/
ok('TrustSeal API access section (API key) masked', /<section data-api-access data-clarity-mask="True"/.test(read('components/trustseal/api-access-section.tsx')))
ok('API key <code> sits inside the masked section', (() => { const s = read('components/trustseal/api-access-section.tsx'); const a = s.indexOf('data-clarity-mask="True"'); const k = s.indexOf('{info.key}</code>'); const e = s.indexOf('</section>'); return a > 0 && k > a && e > k })())
ok('TrustSeal signed-in email masked', /<p data-clarity-mask="True"[^>]*>\s*\{account\?\.email \|\| user\.email\}/.test(read('components/trustseal/dashboard-client.tsx')))
ok('signed-in greeting (user name) masked', /<span data-clarity-mask="True"[^>]*>\{L\('greeting'\)\}, \{user\.name\}<\/span>/.test(read('components/auth/auth-button.tsx')))
const sa = read('components/scamcheck/screenshot-analyzer.tsx')
ok('ScamCheck upload dropzone masked', /data-clarity-mask="True"\s*\n\s*onDragOver=/.test(sa))
ok('ScamCheck screenshot preview (img + OCR overlay) masked', /<div data-clarity-mask="True" className="relative inline-block[\s\S]*?<img ref=\{imgRef\} src=\{preview\}/.test(sa))
ok('ScamCheck extracted entities masked', /<div data-clarity-mask="True" className="flex flex-wrap gap-2 text-xs">\s*\{result\.entities\.urls/.test(sa))
ok('ScamCheck OCR evidence quotes masked', /<span data-clarity-mask="True" className="text-zinc-500">— “\{s\.evidence\}”<\/span>/.test(sa))
ok('ScamCheck explanation masked', /<p data-clarity-mask="True" className="mt-2 text-sm opacity-90">\{result\.explanation\}<\/p>/.test(sa))
ok('screenshot processing untouched (upload API + optimize)', /fetch\('\/api\/scam-intel\/screenshot'/.test(sa) && /async function optimizeImage/.test(sa))
ok('masks are attributes only (no CSS keyed on them)', src.concat(['app/globals.css']).every((p) => !/\[data-clarity-mask/.test(read(p))))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
