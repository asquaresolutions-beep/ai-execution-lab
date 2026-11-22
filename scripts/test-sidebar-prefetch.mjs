#!/usr/bin/env node
// Sidebar prefetch policy (PR #131 review, CodeRabbit finding 2). The shared NavItem sends
// prefetch={false} so the always-visible sidebar stops prefetching every section index; only
// the Dashboard link (`/`) keeps Next's default prefetch. sidebar-nav.tsx is a 'use client'
// .tsx module the plain-node harness can't import, so this asserts the source; the rendered
// props are checked in a browser against a production build.
// Run: node scripts/test-sidebar-prefetch.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const src = fs.readFileSync(new URL('../components/layout/sidebar-nav.tsx', import.meta.url), 'utf8')

const navBlock = src.slice(src.indexOf('const NAV = ['), src.indexOf('\n]\n', src.indexOf('const NAV = [')))
const items = [...navBlock.matchAll(/\{ href: '([^']+)',[^}]*\}/g)].map((m) => ({ href: m[1], text: m[0] }))
const opted = items.filter((i) => /defaultPrefetch: true/.test(i.text))

ok('NAV lists the expected public links, in order', JSON.stringify(items.map((i) => i.href)) === JSON.stringify(
  ['/', '/start-here', '/scams', '/scams/hub/upi-payment-scams', '/docs', '/systems', '/labs', '/case-studies', '/failures', '/logs', '/playbooks', '/tracks', '/pathways', '/tags']))
ok('exactly one item keeps the default prefetch', opted.length === 1)
ok('…and it is Dashboard `/`', opted[0]?.href === '/' && /label: 'Dashboard'/.test(opted[0]?.text ?? ''))
ok('NavItem defaults defaultPrefetch to false', /defaultPrefetch = false,/.test(src))
ok('Link prefetch: omitted (default) for opted items, false for every other item',
  /^\s+prefetch=\{defaultPrefetch \? undefined : false\}$/m.test(src) && (src.match(/^\s+prefetch=/gm) || []).length === 1)
ok('internal tools stay out of the sidebar', !/href: '\/(ops|syndicate|publish)'/.test(navBlock))

console.log(`\nSidebar prefetch tests: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
