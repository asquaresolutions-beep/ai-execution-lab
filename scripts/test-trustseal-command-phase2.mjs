#!/usr/bin/env node
// Command Center Phase-2 (ambitious visual prototype) guard tests. Same hard
// constraints as Phase-1 — NO React Three Fiber, NO new deps, Framer Motion + SVG
// only, mock data, noindex route — plus the Phase-2 hero requirements: a hero
// network + holographic Trust Score core, animated cyber-grid, floating particles,
// and an intel-terminal feed. Static-assert (next build is the integration proof).
// Run: node --experimental-strip-types scripts/test-trustseal-command-phase2.mjs
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
  'components/trustseal/command/hero-network.tsx',
  'components/trustseal/command/intel-terminal.tsx',
]
for (const f of files) ok(`exists: ${f}`, exists(f))
const all = files.map(read).join('\n')

// hard constraints from the brief
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

// ── Phase-2 hero requirements ──
const hero = read('components/trustseal/command/hero-network.tsx')
ok('hero: holographic Trust Score core (score readout)', /TRUST SCORE/.test(hero) && /score/.test(hero))
ok('hero: HUD tick ring', /TICKS/.test(hero))
ok('hero: travelling intelligence particles on edges', /motion\.circle/.test(hero))
ok('hero: ambient field particles', /FIELD/.test(hero))
ok('hero: progress arc uses strokeDashoffset', /strokeDashoffset/.test(hero))

const term = read('components/trustseal/command/intel-terminal.tsx')
ok('terminal: monospace intel styling', /font-mono/.test(term))
ok('terminal: status codes + scanlines', /scanline|repeating-linear-gradient/.test(term) && /code:/.test(term))
ok('terminal: blinking cursor', /steps\(1\)/.test(term))

const cc = read('components/trustseal/command/command-center.tsx')
ok('command center: HeroNetwork is the hero', cc.includes('<HeroNetwork'))
ok('command center: IntelTerminal composed', cc.includes('<IntelTerminal'))
ok('command center: animated cyber-grid backdrop', /backgroundPosition/.test(cc))
ok('command center: floating particle field', /PARTICLES/.test(cc))
for (const part of ['TrustScoreCards', 'RiskPanel', 'VerificationTimeline']) {
  ok(`command center composes: ${part}`, cc.includes(part))
}
ok('left nav + top intelligence bar present', /<nav/.test(cc) && /<header/.test(cc))
ok('stronger TrustSeal identity (seal/hex mark)', /polygon/.test(cc) || /nav-seal/.test(cc))

console.log(`\nCommand Center Phase-2 tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
