#!/usr/bin/env node
// Tests for the Microsoft Clarity integration (TrustSeal / ScamCheck / Lab hosts).
// lib/analytics/clarity.ts has no imports, so it loads directly (including the consent-gated
// loader, exercised against a simulated page with a shared root-domain cookie jar); wiring,
// CSP and masking are static source assertions like the other suites.
// Run: node scripts/test-clarity.mjs
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

// ── consent-gated loading (behavioural, simulated page) ─────────────
// A simulated browser: one cookie jar shared by every *.asquaresolution.com page (Clarity keeps
// _clck/_clsk on the root domain), per-origin localStorage, and a page with a head element.
// Loading the tag is modelled as Clarity reading/writing the shared cookies, so any page that
// loads the tag without its own analytics consent shows up as a cookie change.
const { syncClarity, CLARITY_SCRIPT_ID } = await import('../lib/analytics/clarity.ts')
function makeBrowser() {
  const rootCookies = new Map()
  const storage = new Map()
  const tagHosts = new Map(Object.entries(CLARITY_TAGS).map(([h, t]) => [t, h]))
  function openPage(hostname, pathname = '/', env = PROD) {
    const els = new Map(), appended = [], calls = []
    let cookieReads = 0
    const win = {}
    const doc = {
      getElementById: (id) => els.get(id) ?? null,
      createElement: () => ({ id: '', async: false, src: '' }),
      head: {
        appendChild: (node) => {
          appended.push(node); if (node.id) els.set(node.id, node)
          const tag = (node.src.match(/clarity\.ms\/tag\/([a-z0-9]+)$/) || [])[1]
          if (tagHosts.get(tag) === hostname) { cookieReads++; rootCookies.set('_clck', rootCookies.get('_clck') || `uid-${hostname}`); rootCookies.set('_clsk', `session-${hostname}-${appended.length}`) }
        },
      },
    }
    const page = {
      hostname, win, doc, appended, calls,
      get cookieReads() { return cookieReads },
      mount() { // what <Clarity /> does on mount
        const s = storage.get(hostname) ?? null
        return syncClarity(parseStoredConsent(s), { hostname, pathname, env, win, doc })
      },
      save(prefs) { // what ConsentBanner.save() → apply() → setClarityConsent() does
        storage.set(hostname, JSON.stringify({ ...prefs, ts: 1 }))
        return syncClarity(prefs, { hostname, pathname, env, win, doc })
      },
      clarityScripts: () => appended.filter((n) => n.id === CLARITY_SCRIPT_ID),
      queued: () => (win.clarity?.q || []).map((a) => Array.from(a)),
    }
    return page
  }
  return { rootCookies, storage, openPage }
}
const G = 'granted', D = 'denied'

{ // 1. first visit: no sc-consent-v1 → nothing
  const b = makeBrowser(); const p = b.openPage('scamcheck.asquaresolution.com')
  ok('1. no stored consent → skipped', p.mount() === 'skipped')
  ok('1. no stored consent → no script, no window.clarity, no queue', p.clarityScripts().length === 0 && p.win.clarity === undefined && p.appended.length === 0)
}
{ // 2. analytics denied (Reject non-essential)
  const b = makeBrowser(); const p = b.openPage('lab.asquaresolution.com')
  b.storage.set('lab.asquaresolution.com', '{"analytics":false,"ads":false,"ts":1}')
  ok('2. analytics=false → skipped, nothing added', p.mount() === 'skipped' && p.appended.length === 0 && p.win.clarity === undefined)
  ok('2. saving Reject on a clean page adds nothing', p.save({ analytics: false, ads: false }) === 'skipped' && p.appended.length === 0 && p.win.clarity === undefined)
}
{ // 3. ads-only
  const b = makeBrowser(); const p = b.openPage('trustseal.asquaresolution.com', '/en')
  b.storage.set('trustseal.asquaresolution.com', '{"analytics":false,"ads":true,"ts":1}')
  ok('3. ads-only stored → skipped, nothing added', p.mount() === 'skipped' && p.appended.length === 0 && p.win.clarity === undefined)
  ok('3. saving ads-only adds nothing', p.save({ analytics: false, ads: true }) === 'skipped' && p.appended.length === 0)
}
{ // 4. analytics accepted (returning visit)
  for (const [host, id] of Object.entries(CLARITY_TAGS)) {
    const b = makeBrowser(); const p = b.openPage(host)
    b.storage.set(host, '{"analytics":true,"ads":false,"ts":1}')
    ok(`4. ${host}: stored analytics=true → loaded`, p.mount() === 'loaded')
    ok(`4. ${host}: exactly one tag, correct id, async`, p.clarityScripts().length === 1 && p.clarityScripts()[0].src === `https://www.clarity.ms/tag/${id}` && p.clarityScripts()[0].async === true)
    ok(`4. ${host}: consentv2 queued with the stored choice`, JSON.stringify(p.queued()) === JSON.stringify([['consentv2', { ad_Storage: D, analytics_Storage: G }]]))
  }
}
{ // 5. dynamic acceptance during the same visit
  const b = makeBrowser(); const p = b.openPage('scamcheck.asquaresolution.com')
  ok('5. mount with no consent → skipped', p.mount() === 'skipped' && p.appended.length === 0)
  ok('5. Accept all mid-visit → loaded without reload', p.save({ analytics: true, ads: true }) === 'loaded')
  ok('5. exactly one ScamCheck tag', p.clarityScripts().length === 1 && p.clarityScripts()[0].src.endsWith('/yisc9590xj'))
  ok('5. consentv2 granted/granted queued before the tag', JSON.stringify(p.queued()) === JSON.stringify([['consentv2', { ad_Storage: G, analytics_Storage: G }]]))
}
{ // 6. duplicate prevention
  const b = makeBrowser(); const p = b.openPage('lab.asquaresolution.com')
  b.storage.set('lab.asquaresolution.com', '{"analytics":true,"ads":true,"ts":1}')
  p.mount(); p.mount()
  const r1 = p.save({ analytics: true, ads: true }), r2 = p.save({ analytics: true, ads: false })
  ok('6. repeated mounts/saves never add a second tag', p.clarityScripts().length === 1 && p.appended.length === 1)
  ok('6. later calls only update consent', r1 === 'updated' && r2 === 'updated')
  ok('6. queue holds one call per mount/save', p.queued().length === 4 && p.queued().every((c) => c[0] === 'consentv2'))
}
{ // 13. Consent V2 transitions: grant → withdraw → re-grant, never re-initialised
  const b = makeBrowser(); const p = b.openPage('trustseal.asquaresolution.com', '/en')
  p.mount(); p.save({ analytics: true, ads: false }); p.save({ analytics: false, ads: false }); p.save({ analytics: true, ads: true })
  const q = p.queued()
  ok('13. grant → withdraw → re-grant emits the matching consentv2 sequence', JSON.stringify(q) === JSON.stringify([
    ['consentv2', { ad_Storage: D, analytics_Storage: G }],
    ['consentv2', { ad_Storage: D, analytics_Storage: D }],
    ['consentv2', { ad_Storage: G, analytics_Storage: G }],
  ]))
  ok('13. withdrawal does not reinitialise or add a tag', p.clarityScripts().length === 1)
  ok('13. no deprecated Consent API v1 call', q.every((c) => c[0] === 'consentv2'))
  const b2 = makeBrowser(); const p2 = b2.openPage('trustseal.asquaresolution.com', '/en')
  b2.storage.set('trustseal.asquaresolution.com', '{"analytics":true,"ads":true,"ts":1}')
  p2.mount(); p2.save({ analytics: false, ads: true })
  ok('13. withdrawing analytics but keeping ads → analytics denied, ads granted', JSON.stringify(p2.queued()[1]) === JSON.stringify(['consentv2', { ad_Storage: G, analytics_Storage: D }]))
}
// 7–10. cross-subdomain: consent on one property must never start Clarity on another
for (const [label, grantHost, deniedHost, deniedPath] of [
  ['7. Lab accepted → ScamCheck fresh', 'lab.asquaresolution.com', 'scamcheck.asquaresolution.com', '/'],
  ['8. ScamCheck accepted → TrustSeal fresh', 'scamcheck.asquaresolution.com', 'trustseal.asquaresolution.com', '/en'],
  ['9. TrustSeal accepted → Lab fresh', 'trustseal.asquaresolution.com', 'lab.asquaresolution.com', '/'],
]) {
  for (const deniedState of [null, '{"analytics":false,"ads":false,"ts":1}', '{"analytics":false,"ads":true,"ts":1}']) {
    const b = makeBrowser()
    const a = b.openPage(grantHost); a.mount(); a.save({ analytics: true, ads: true })
    const cookiesAfterGrant = JSON.stringify([...b.rootCookies])
    if (deniedState) b.storage.set(deniedHost, deniedState)
    const d = b.openPage(deniedHost, deniedPath)
    const mounted = d.mount()
    const state = deniedState ? JSON.parse(deniedState) : null
    const after = state ? d.save({ analytics: false, ads: state.ads }) : 'n/a'
    const tag = `${deniedState ? (JSON.parse(deniedState).ads ? 'ads-only' : 'denied') : 'no consent'}`
    ok(`${label} (${tag}): granting host loaded Clarity and set root cookies`, a.clarityScripts().length === 1 && b.rootCookies.has('_clck') && b.rootCookies.has('_clsk'))
    ok(`${label} (${tag}): denied host does not initialise Clarity`, mounted === 'skipped' && (after === 'n/a' || after === 'skipped') && d.appended.length === 0 && d.win.clarity === undefined)
    ok(`${label} (${tag}): denied host leaves shared _clck/_clsk untouched`, JSON.stringify([...b.rootCookies]) === cookiesAfterGrant && d.cookieReads === 0)
  }
}
{ // 10. WordPress (GTM Clarity, root-domain cookies already present) → Vercel host without consent
  const b = makeBrowser()
  b.rootCookies.set('_clck', 'uid-wordpress'); b.rootCookies.set('_clsk', 'session-wordpress')
  for (const host of Object.keys(CLARITY_TAGS)) {
    const d = b.openPage(host)
    ok(`10. WordPress cookies present → ${host} without consent stays unloaded`, d.mount() === 'skipped' && d.appended.length === 0 && d.win.clarity === undefined && d.cookieReads === 0)
  }
  ok('10. WordPress root cookies unchanged by Vercel pages', b.rootCookies.get('_clck') === 'uid-wordpress' && b.rootCookies.get('_clsk') === 'session-wordpress')
}
{ // 11. unknown / preview / localhost hosts, even with analytics granted
  for (const [host, env] of [['ai-execution-lab-three.vercel.app', PROD], ['ai-execution-veclm4mov-a-square-solutions-projects.vercel.app', PROD], ['localhost', PROD], ['127.0.0.1', PROD], ['staging.asquaresolution.com', PROD], ['evil-lab.asquaresolution.com', PROD], ['lab.asquaresolution.com', { nodeEnv: 'production', vercelEnv: 'preview' }], ['lab.asquaresolution.com', { nodeEnv: 'development' }]]) {
    const b = makeBrowser(); const p = b.openPage(host, '/', env)
    b.storage.set(host, '{"analytics":true,"ads":true,"ts":1}')
    ok(`11. ${host} ${JSON.stringify(env)} + analytics granted → no Clarity`, p.mount() === 'skipped' && p.save({ analytics: true, ads: true }) === 'skipped' && p.appended.length === 0 && p.win.clarity === undefined)
  }
}
{ // 12. /embed/* even with analytics granted
  for (const path of ['/embed/checker', '/embed']) {
    const b = makeBrowser(); const p = b.openPage('scamcheck.asquaresolution.com', path)
    b.storage.set('scamcheck.asquaresolution.com', '{"analytics":true,"ads":true,"ts":1}')
    ok(`12. ${path} + analytics granted → no Clarity`, p.mount() === 'skipped' && p.save({ analytics: true, ads: true }) === 'skipped' && p.appended.length === 0)
  }
}
ok('lab host serving /trustseal/en with consent → Lab tag (not TrustSeal)', (() => { const b = makeBrowser(); const p = b.openPage('lab.asquaresolution.com', '/trustseal/en'); p.save({ analytics: true, ads: false }); return p.clarityScripts().length === 1 && p.clarityScripts()[0].src.endsWith('/yiscisont7') })())

// ── component / banner wiring ────────────────────────────────────────
const comp = code(read('components/analytics/clarity.tsx'))
const libSrc = code(read('lib/analytics/clarity.ts'))
ok('component is a client component', /^'use client'/.test(read('components/analytics/clarity.tsx')))
ok('component uses browser hostname + pathname', /window\.location\.hostname/.test(comp) && /window\.location\.pathname/.test(comp))
ok('component passes NODE_ENV + NEXT_PUBLIC_VERCEL_ENV', /process\.env\.NODE_ENV/.test(comp) && /process\.env\.NEXT_PUBLIC_VERCEL_ENV/.test(comp))
ok('component mount goes through syncClarity with the stored choice', /parseStoredConsent\(window\.localStorage\.getItem\(CONSENT_STORAGE_KEY\)\)/.test(comp) && /syncClarity\(stored, browserContext\(\)\)/.test(comp))
ok('setClarityConsent goes through syncClarity', /export function setClarityConsent\(prefs: StoredConsent\): void \{[\s\S]*?syncClarity\(prefs, browserContext\(\)\)/.test(comp))
ok('component never touches the tag or window.clarity directly', !/createElement|appendChild|clarity\(/.test(comp))
ok('effect runs once (empty deps)', /\},\s*\[\]\)/.test(comp))
ok('gate: analytics must be exactly true before any load', /if \(prefs\?\.analytics !== true\) return 'skipped'/.test(libSrc) && libSrc.indexOf("prefs?.analytics !== true") < libSrc.indexOf('ctx.doc.createElement(') && libSrc.indexOf("prefs?.analytics !== true") < libSrc.indexOf('ctx.win.clarity = queue'))
// raw source: the comment stripper would cut the "https://" URL literal
ok('tag loads async from www.clarity.ms', /script\.async = true/.test(libSrc) && /script\.src = `https:\/\/www\.clarity\.ms\/tag\/\$\{tag\}`/.test(read('lib/analytics/clarity.ts')))
ok('no deprecated Consent API v1 anywhere', !/clarity\(\s*['"]consent['"]/.test(libSrc + comp + code(read('components/consent/consent-banner.tsx'))))
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
ok('clarity.ms/tag referenced only by the Clarity loader', src.filter((p) => /clarity\.ms\/tag/.test(read(p))).join(',') === 'lib/analytics/clarity.ts')
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
