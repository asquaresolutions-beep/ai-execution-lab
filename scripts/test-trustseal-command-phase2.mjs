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
ok('hero: holographic Trust Score core (seal hexagon + score readout)', /hex\(CORE\)/.test(hero) && /\{score\}/.test(hero))
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

// ── Phase-2.1 immersive refinement ──
// 1+2. Dedicated immersive layout: both global chrome layers gate off /command.
const chrome = read('components/layout/site-chrome.tsx')
ok('immersive: SiteChrome suppresses lab chrome on /command', /usePathname/.test(chrome) && /command/.test(chrome))
const lhead = read('components/trustseal/locale-header.tsx')
ok('immersive: TrustSeal locale header gated off /command', /usePathname/.test(lhead) && /return null/.test(lhead))
const tslayout = read('app/trustseal/[locale]/layout.tsx')
ok('immersive: layout uses the gated header (no inline marketing header)', /TrustSealLocaleHeader/.test(tslayout) && !/<header/.test(tslayout))
// 3. Mobile: terminal rows wrap rather than clip; no whitespace-nowrap overflow.
ok('mobile: terminal rows wrap (no whitespace-nowrap clipping)', !/whitespace-nowrap/.test(term) && /flex-wrap/.test(term))
// 4. Stacked: terminal forced height only at xl, content-driven below.
// Terminal wrapper carries the xl-only class; it must NOT carry an unconditional
// inline minHeight (the hero panel legitimately keeps one for its absolute SVG).
ok('stacked: terminal min-height applied only at xl', /xl:col-span-4 xl:min-h-\[460px\]/.test(cc) && !/xl:col-span-4["'] style=\{\{ minHeight: 460/.test(cc))
// 5. Identity: seal hexagon + verified check integrated into the holographic core.
ok('identity: seal hexagon frame in core', /points=\{hex\(CORE\)\}/.test(hero) && /hn-seal/.test(hero))
ok('identity: verified seal check in core', /stroke="url\(#hn-seal\)"/.test(hero) && /<path d=\{`M/.test(hero))

// ── Phase-2.2 polish ──
const widgets = read('components/trustseal/command/widgets.tsx')
// 1. Trust Score shown once (hero only) — the ops rail must NOT carry a score card.
ok('polish: no duplicate Trust Score card in ops rail', !/'Trust Score'/.test(widgets) && /'Monitored'/.test(widgets))
// 2. Lower section adopts the hero seal/intelligence aesthetic.
ok('polish: shared HexBadge seal motif in panels', /function HexBadge/.test(widgets) && /<HexBadge/.test(widgets))
ok('polish: timeline uses hexagon markers', /<polygon points="12,2 20,7/.test(widgets))
ok('polish: ops cards use mono labels', /font-mono text-\[10px\] uppercase/.test(widgets))
// 3. Mobile: cleaner top bar (wraps, subline hidden < sm) + zero overflow preserved.
ok('polish: top bar wraps + subline hidden on mobile', /flex-wrap/.test(cc) && /hidden font-mono text-\[10px\] sm:block/.test(cc))
// 4. Network readability: labels placed radially outward with a halo.
ok('polish: node labels placed outward with halo', /n\.y >= CY \? n\.y \+ n\.r \+ 12 : n\.y - n\.r - 7/.test(hero) && /paintOrder="stroke"/.test(hero))
// 5. Terminal scroll-offset: opaque, raised sticky header so content passes behind.
ok('polish: sticky header opaque + z-20 (scroll-offset)', /sticky top-0 z-20/.test(cc) && /rgba\(5,8,17,0\.92\)/.test(cc))

console.log(`\nCommand Center Phase-2.2 tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
