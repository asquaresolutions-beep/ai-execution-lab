#!/usr/bin/env node
// Middleware hotfix tests: the trustseal-host asset allowlist must let
// /{locale}/trust/{domain} reach the seal route (domains are NOT assets) while
// genuine assets still pass through — and the scamcheck/lab branches stay
// untouched. Extracts the REAL TS_ASSET_EXT regex from middleware.ts and tests it.
// Run: node --experimental-strip-types scripts/test-trustseal-middleware-seal.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const src = fs.readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8')

// Extract the actual regex literal from source and reconstruct it.
const m = src.match(/const TS_ASSET_EXT\s*=\s*(\/.*\/[a-z]*)/)
ok('TS_ASSET_EXT defined in middleware', !!m)
const ASSET = m ? (0, eval)(m[1]) : /$^/

// Domain TLD paths must NOT be classified as assets → they get the locale rewrite.
for (const p of ['/en/trust/asquaresolution.com', '/en/trust/example.io', '/en/trust/example.org', '/hi/trust/foo.co.uk', '/en/trust/bar.dev']) {
  ok(`rewrites (not asset): ${p}`, ASSET.test(p) === false)
}
// Genuine assets must still be classified as assets → passthrough.
for (const p of ['/styles.css', '/app.js', '/logo.png', '/icon.svg', '/data.json', '/font.woff2', '/favicon.ico', '/site.webmanifest']) {
  ok(`asset passthrough: ${p}`, ASSET.test(p) === true)
}

// Scope: the trustseal branch must USE the allowlist (not the old generic regex).
ok('trustseal branch uses TS_ASSET_EXT', /TS_ASSET_EXT\.test\(pathname\)/.test(src))
// The old generic per-segment regex must be GONE from the trustseal branch.
// (It legitimately remains in scamcheck isAllowed — that branch is untouched.)
const tsBranch = src.slice(src.indexOf('if (isTrustSealHost(host))'), src.indexOf('if (!isScamCheckHost(host))'))
ok('generic /\\.[a-z0-9]+$/ removed from trustseal branch', !/\/\\\.\[a-z0-9\]\+\$\/i\.test\(pathname\)/.test(tsBranch) && !tsBranch.includes('/\\.[a-z0-9]+$/i.test(pathname)'))
// Scope guard: scamcheck isAllowed still has its own generic asset check (untouched).
ok('scamcheck isAllowed generic asset check untouched', /\/\\?\.\[a-z0-9\]\+\$\/i\.test\(path\)/.test(src) || src.includes('/\\.[a-z0-9]+$/i.test(path)'))
// Scope guard: locale-rewrite + scamcheck logic intact.
ok('trustseal locale rewrite intact', /isLocale\(pathname\.split\('\/'\)\[1\]\)/.test(src) && /`\/trustseal\$\{pathname\}`/.test(src))
ok('scamcheck branch intact (isScamCheckHost / scam-intelligence)', /isScamCheckHost/.test(src) && /scam-intelligence/.test(src))

console.log(`\nMiddleware seal-route tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
