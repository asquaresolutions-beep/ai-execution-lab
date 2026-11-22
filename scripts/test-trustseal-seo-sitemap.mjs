#!/usr/bin/env node
// TrustSeal SEO host-fix tests. robots.ts uses next/headers and the sitemap builder
// (lib/seo/sitemap.ts, served by app/sitemap.xml/route.ts) uses @/-alias imports this
// plain-node script can't run, so we static-assert the host wiring + the
// verified-seal-URL emission, and prove ScamCheck/Lab branches are untouched.
// The seeded next-start curl check (Host headers) is the runtime integration proof;
// eval/sitemap-cdn-cache.test.mjs exercises the route's cache header end to end.
// Run: node --experimental-strip-types scripts/test-trustseal-seo-sitemap.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

// ── robots.ts: trustseal host serves trustseal robots ─────────────
const robots = read('app/robots.ts')
ok('robots: trustseal.* host branch', /host\.startsWith\('trustseal\.'\)/.test(robots))
ok('robots: trustseal base url', /'https:\/\/trustseal\.asquaresolution\.com'/.test(robots))
ok('robots: still advertises per-host sitemap + host', /sitemap: `\$\{base\}\/sitemap\.xml`/.test(robots) && /host: base/.test(robots))
ok('robots: lab branch untouched', /host\.startsWith\('lab\.'\)/.test(robots) && /'https:\/\/lab\.asquaresolution\.com'/.test(robots))
ok('robots: scamcheck remains the default fallback', /'https:\/\/scamcheck\.asquaresolution\.com'/.test(robots))

// ── sitemap.ts: trustseal branch + verified seal URLs ─────────────
const sm = read('lib/seo/sitemap.ts')
ok('sitemap: TRUST base const', /const TRUST = 'https:\/\/trustseal\.asquaresolution\.com'/.test(sm))
ok('sitemap: trustseal host → trustSealSitemap()', /if \(host\.startsWith\('trustseal\.'\)\) return trustSealSitemap\(\)/.test(sm))
ok('sitemap: trustSealSitemap defined (async)', /async function trustSealSitemap\(\): Promise<SitemapResult>/.test(sm))
ok('sitemap: queries ts_claims where status == verified', /getStore\(\)\.query<[^>]*>\('ts_claims'/.test(sm) && /field: 'status', op: '==', value: 'verified'/.test(sm))
ok('sitemap: emits /en/trust/{domain} on the trustseal host', /url: `\$\{TRUST\}\/en\/trust\/\$\{d\}`/.test(sm))
ok('sitemap: never 500s if store unavailable (try/catch → empty)', /try \{/.test(sm) && /catch \{/.test(sm))
ok('sitemap: a failed TrustSeal query marks the result degraded', /catch \{[^}]*degraded = true[^}]*\}/.test(sm) && /return \{ entries: \[\.\.\.staticEntries, \.\.\.sealEntries\], degraded \}/.test(sm))

// ── /sitemap.xml route: CDN cache header only on a non-degraded result ──
const route = read('app/sitemap.xml/route.ts')
const nextConfig = read('next.config.mjs')
ok('route: builds from lib/seo/sitemap with the request Host header', /import \{ buildSitemap \} from '@\/lib\/seo\/sitemap'/.test(route) && /request\.headers\.get\('host'\)/.test(route))
ok('route: Vercel-CDN-Cache-Control set only when not degraded', /if \(!degraded\) headers\['Vercel-CDN-Cache-Control'\] = CDN_CACHE/.test(route) && (route.match(/Vercel-CDN-Cache-Control'\]/g) || []).length === 1)
ok('route: keeps the metadata route Content-Type + Cache-Control', /'Content-Type': 'application\/xml'/.test(route) && /'Cache-Control': 'public, max-age=0, must-revalidate'/.test(route))
ok('next.config: no path-wide /sitemap.xml header rule (robots rule kept)', !/source: '\/sitemap\.xml'/.test(nextConfig) && /source: '\/robots\.txt'/.test(nextConfig))

// ── ScamCheck behavior UNCHANGED ──────────────────────────────────
ok('sitemap: scamcheck remains the DEFAULT branch', /return \{ entries: scamcheckSitemap\(\), degraded: false \}/.test(sm) && /function scamcheckSitemap\(\)/.test(sm))
ok('sitemap: scamcheck still lists checker slugs + intel', /allCheckerSlugs\(\)\.map/.test(sm) && /allIntelSlugs\(\)\.map/.test(sm))
ok('sitemap: SCAM base const unchanged', /const SCAM = 'https:\/\/scamcheck\.asquaresolution\.com'/.test(sm))
// trustseal emits ONLY trustseal URLs (no SCAM/LAB leakage in trustSealSitemap)
const tsFn = sm.slice(sm.indexOf('async function trustSealSitemap'))
const tsBody = tsFn.slice(0, tsFn.indexOf('\n}\n') + 2)
ok('sitemap: trustSealSitemap emits ONLY trustseal URLs (no SCAM/LAB)', !/\bSCAM\b/.test(tsBody) && !/\bLAB\b/.test(tsBody))

// ── Lab behavior UNCHANGED ────────────────────────────────────────
ok('sitemap: lab host → labSitemap() (untouched)', /if \(host\.startsWith\('lab\.'\)\) return \{ entries: labSitemap\(\), degraded: false \}/.test(sm) && /function labSitemap\(\)/.test(sm))
ok('sitemap: LAB base const unchanged', /const LAB = 'https:\/\/lab\.asquaresolution\.com'/.test(sm))
ok('sitemap: lab still lists content items + tracks', /getAllItems\(\)\.map/.test(sm) && /TRACKS\.map/.test(sm))

console.log(`\nTrustSeal SEO sitemap tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
