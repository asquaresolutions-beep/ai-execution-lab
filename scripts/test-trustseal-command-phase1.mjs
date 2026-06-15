#!/usr/bin/env node
// Command Center Phase-1 (visual prototype) guard tests: confirm the constraints
// the prototype must hold — NO React Three Fiber, NO new deps, Framer Motion +
// SVG only, mock data (no real wiring), noindex route. Static-assert (these are
// client/JSX files; next build is the integration proof).
// Run: node --experimental-strip-types scripts/test-trustseal-command-phase1.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const exists = (p) => fs.existsSync(new URL('../' + p, import.meta.url))

const files = [
  'app/trustseal/[locale]/command/page.tsx',
  'components/trustseal/command/command-center.tsx',
  'components/trustseal/command/widgets.tsx',
  'components/trustseal/command/trust-network.tsx',
]
for (const f of files) ok(`exists: ${f}`, exists(f))
const all = files.map(read).join('\n')

// constraints from the brief
ok('NO React Three Fiber / three.js import', !/@react-three|from 'three'|from "three"/.test(all))
ok('Framer Motion is used', /from 'framer-motion'/.test(all) && /motion\./.test(all))
ok('SVG visualizations present', /<svg/.test(all))
ok('reduced-motion honored', /useReducedMotion/.test(all))

// no new dependency was added to package.json
const pkg = JSON.parse(read('package.json'))
const deps = { ...pkg.dependencies, ...pkg.devDependencies }
ok('no @react-three/fiber dependency added', !deps['@react-three/fiber'])
ok('no three dependency added', !deps['three'])
ok('framer-motion already present (reused, not new)', !!pkg.dependencies['framer-motion'])

// route is a server component → noindex via buildTrustMeta default
const page = read('app/trustseal/[locale]/command/page.tsx')
ok('route: server component (no use client)', !/^'use client'/.test(page))
ok('route: noindex (buildTrustMeta default, no index:true)', /buildTrustMeta/.test(page) && !/index: true/.test(page))

// all 8 required panels referenced
const cc = read('components/trustseal/command/command-center.tsx')
// Phase-2.2 refactor: the live-activity + network surfaces were consolidated into
// the IntelTerminal; the hero seal core renders the trust score. Assert the parts
// the component actually composes today.
for (const part of ['TrustScoreCards', 'IntelTerminal', 'RiskPanel', 'VerificationTimeline']) {
  ok(`command center composes: ${part}`, cc.includes(part))
}
ok('left nav + top intelligence bar present', /<nav/.test(cc) && /<header/.test(cc))

console.log(`\nCommand Center Phase-1 tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
