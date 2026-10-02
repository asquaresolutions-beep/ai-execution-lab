#!/usr/bin/env node
// Middleware matcher tests: the middleware must NOT be invoked on the Lab host (it is a
// no-op there — see the "lab/other hosts untouched" early return) and MUST still be invoked
// on the ScamCheck and TrustSeal hosts, where it does the routing. Extracts the REAL `config`
// literal from middleware.ts and evaluates it with Next.js's own matcher code.
// Run: node scripts/test-middleware-matcher.mjs
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { unstable_doesMiddlewareMatch } = require('next/experimental/testing/server')

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const src = fs.readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8')

// Extract the actual config literal from source and evaluate it.
const m = src.match(/export const config = (\{[\s\S]*?\n\})/)
ok('config literal found in middleware.ts', !!m)
const config = m ? (0, eval)('(' + m[1] + ')') : {}
const runs = (host, path) => unstable_doesMiddlewareMatch({ config, url: `https://${host.split(':')[0]}${path}`, headers: { host } })

const PATHS = ['/', '/tracks/a/b/c', '/tags/x', '/scams/type/upi-fraud', '/api/og', '/api/lead', '/sitemap.xml', '/robots.txt', '/ops', '/embed/checker', '/trustseal/en', '/scamcheck', '/_next/data/x.json']

// 1. Lab host: middleware is skipped (host matching is case-insensitive and ignores the port).
for (const h of ['lab.asquaresolution.com', 'LAB.ASQUARESOLUTION.COM', 'lab.asquaresolution.com:443']) {
  for (const p of PATHS) ok(`skips ${h}${p}`, runs(h, p) === false)
}

// 2. Product hosts: middleware MUST run on every non-static path. This protects the routing.
for (const h of ['scamcheck.asquaresolution.com', 'trustseal.asquaresolution.com', 'scamcheck-preview.vercel.app', 'trustseal-preview.vercel.app']) {
  for (const p of [...PATHS, '/en/pricing', '/hi/trust/acme.com', '/scams/x', '/pricing', '/no-such-page']) ok(`runs on ${h}${p}`, runs(h, p) === true)
}

// 3. Only the exact Lab host is exempt: look-alikes, vercel.app aliases and deployment URLs still run.
for (const h of ['xlab.asquaresolution.com', 'lab.asquaresolution.com.evil.example', 'lab-asquaresolution.com', 'lab.asquaresolution.co', 'ai-execution-lab-three.vercel.app', 'ai-execution-9cqn7ov1d-a-square-solutions-projects.vercel.app']) {
  ok(`still runs on ${h}/`, runs(h, '/') === true)
}

// 4. Static exclusions are unchanged on every host.
for (const h of ['lab.asquaresolution.com', 'scamcheck.asquaresolution.com', 'trustseal.asquaresolution.com']) {
  for (const p of ['/_next/static/chunks/x.js', '/_next/image?url=x', '/favicon.ico']) ok(`static excluded ${h}${p}`, runs(h, p) === false)
}

// 5. Scope guard: both in-code host gates remain (the matcher is an optimisation, not the gate).
ok('trustseal host gate intact', /if \(isTrustSealHost\(host\)\)/.test(src))
ok('non-scamcheck hosts still pass through in code', /if \(!isScamCheckHost\(host\)\) return NextResponse\.next\(\)/.test(src))

console.log(`\nMiddleware matcher tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
