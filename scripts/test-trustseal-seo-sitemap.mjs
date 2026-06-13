#!/usr/bin/env node
// TrustSeal SEO host-fix tests. robots.ts/sitemap.ts use next/headers + @/-alias
// imports the node harness can't run, so we static-assert the host wiring + the
// verified-seal-URL emission, and prove ScamCheck/Lab branches are untouched.
// The seeded next-start curl check (Host headers) is the runtime integration proof.
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
const sm = read('app/sitemap.ts')
ok('sitemap: TRUST base const', /const TRUST = 'https:\/\/trustseal\.asquaresolution\.com'/.test(sm))
ok('sitemap: trustseal host → trustSealSitemap()', /if \(host\.startsWith\('trustseal\.'\)\) return trustSealSitemap\(\)/.test(sm))
ok('sitemap: trustSealSitemap defined (async)', /async function trustSealSitemap\(\): Promise<MetadataRoute\.Sitemap>/.test(sm))
ok('sitemap: queries ts_claims where status == verified', /getStore\(\)\.query<[^>]*>\('ts_claims'/.test(sm) && /field: 'status', op: '==', value: 'verified'/.test(sm))
ok('sitemap: emits /en/trust/{domain} on the trustseal host', /url: `\$\{TRUST\}\/en\/trust\/\$\{d\}`/.test(sm))
ok('sitemap: never 500s if store unavailable (try/catch → empty)', /try \{/.test(sm) && /catch \{/.test(sm))

// ── ScamCheck behavior UNCHANGED ──────────────────────────────────
ok('sitemap: scamcheck remains the DEFAULT branch', /return scamcheckSitemap\(\)/.test(sm) && /function scamcheckSitemap\(\)/.test(sm))
ok('sitemap: scamcheck still lists checker slugs + intel', /allCheckerSlugs\(\)\.map/.test(sm) && /allIntelSlugs\(\)\.map/.test(sm))
ok('sitemap: SCAM base const unchanged', /const SCAM = 'https:\/\/scamcheck\.asquaresolution\.com'/.test(sm))
// trustseal emits ONLY trustseal URLs (no SCAM/LAB leakage in trustSealSitemap)
const tsFn = sm.slice(sm.indexOf('async function trustSealSitemap'))
const tsBody = tsFn.slice(0, tsFn.indexOf('\n}\n') + 2)
ok('sitemap: trustSealSitemap emits ONLY trustseal URLs (no SCAM/LAB)', !/\bSCAM\b/.test(tsBody) && !/\bLAB\b/.test(tsBody))

// ── Lab behavior UNCHANGED ────────────────────────────────────────
ok('sitemap: lab host → labSitemap() (untouched)', /if \(host\.startsWith\('lab\.'\)\) return labSitemap\(\)/.test(sm) && /function labSitemap\(\)/.test(sm))
ok('sitemap: LAB base const unchanged', /const LAB = 'https:\/\/lab\.asquaresolution\.com'/.test(sm))
ok('sitemap: lab still lists content items + tracks', /getAllItems\(\)\.map/.test(sm) && /TRACKS\.map/.test(sm))

console.log(`\nTrustSeal SEO sitemap tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
