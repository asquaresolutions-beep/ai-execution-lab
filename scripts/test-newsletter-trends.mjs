#!/usr/bin/env node
// Tests for the dashboard time-series aggregation (PR #7). Imports the REAL
// helper via Node TS type-stripping. `now` is pinned for determinism.
// Run: node --experimental-strip-types scripts/test-newsletter-trends.mjs
import { subscriberTrends, dayKey, isoWeekKey } from '../lib/newsletter/subscribers.ts'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const eq = (l, g, w) => ok(`${l} (got ${JSON.stringify(g)})`, JSON.stringify(g) === JSON.stringify(w))

// Pin "now" to 2026-06-09T00:00:00Z
const NOW = Date.parse('2026-06-09T12:00:00Z')
const d = (s) => `2026-06-${String(s).padStart(2, '0')}T10:00:00Z`

eq('dayKey', dayKey('2026-06-09T10:00:00Z'), '2026-06-09')
ok('isoWeekKey format', /^2026-W\d\d$/.test(isoWeekKey('2026-06-09T10:00:00Z')))
eq('dayKey empty', dayKey(undefined), '')

const rows = [
  { createdAt: d(9), source: 'scan-result-quick', verdict: 'scam', device: 'mobile' },
  { createdAt: d(9), source: 'scan-result-quick', verdict: 'safe', device: 'desktop' },
  { createdAt: d(8), source: 'blog:upi-refund-qr-code-scams', verdict: undefined, device: 'desktop' },
  { createdAt: d(2), source: 'scan-result-screenshot', verdict: 'suspicious', device: 'mobile' },
  { createdAt: '2026-04-01T10:00:00Z', source: 'scan-result-quick', verdict: 'scam', device: 'mobile' }, // before window
]
const t = subscriberTrends(rows, NOW, 30, 12)

// daily: 30 points, chronological, zero-filled, ends today
eq('daily length', t.daily.length, 30)
eq('daily last key is today', t.daily[t.daily.length - 1].key, '2026-06-09')
eq('daily first key is 29d ago', t.daily[0].key, '2026-05-11')
eq('today count', t.daily[t.daily.length - 1].count, 2)
eq('jun 8 count', t.daily.find((p) => p.key === '2026-06-08').count, 1)
eq('jun 2 count', t.daily.find((p) => p.key === '2026-06-02').count, 1)
ok('a zero day exists', t.daily.some((p) => p.count === 0))

// cumulative: starts from the 1 pre-window subscriber (Apr 1), ends at total-in-or-before-window
eq('cumulative length', t.cumulative.length, 30)
eq('cumulative final = all 5', t.cumulative[t.cumulative.length - 1].count, 5)
ok('cumulative is non-decreasing', t.cumulative.every((p, i, a) => i === 0 || p.count >= a[i - 1].count))
ok('cumulative starts >=1 (pre-window Apr 1)', t.cumulative[0].count >= 1)

// weekly: 12 distinct ISO weeks, chronological
eq('weekly length', t.weekly.length, 12)
ok('weekly keys distinct', new Set(t.weekly.map((w) => w.key)).size === 12)
ok('weekly chronological', t.weekly.every((w, i, a) => i === 0 || w.key >= a[i - 1].key))
ok('current week has >=3 signups (jun 8-9)', t.weekly[t.weekly.length - 1].count >= 3)

// topSources ranked desc
eq('top source is scan-result-quick (3)', t.topSources[0].key, 'scan-result-quick')
eq('top source count', t.topSources[0].count, 3)
ok('blog source present', t.topSources.some((s) => s.key === 'blog:upi-refund-qr-code-scams'))
ok('all sources counted', t.topSources.reduce((n, s) => n + s.count, 0) === rows.length)

// empty input safe
const e = subscriberTrends([], NOW)
eq('empty daily length', e.daily.length, 30)
eq('empty cumulative final 0', e.cumulative[e.cumulative.length - 1].count, 0)
eq('empty topSources', e.topSources, [])

console.log(`\nnewsletter-trends: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
