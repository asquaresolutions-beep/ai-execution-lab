#!/usr/bin/env node
// Tests for newsletter idempotency + analytics helpers.
// Imports the REAL module (lib/newsletter/subscribers.ts) via Node's native
// TS type-stripping (Node >= 22.6 / runs on v25 here), so there is no drift
// between tested logic and shipped logic.
// Run: node --experimental-strip-types scripts/test-newsletter-idempotency.mjs
import {
  normalizeEmail, isValidEmail, subscriberDocId,
  normalizeVerdict, normalizeDevice, normalizeSource, summarizeSubscribers,
} from '../lib/newsletter/subscribers.ts'

let pass = 0, fail = 0
const eq = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; }
  else { fail++; console.error(`✗ ${label}\n   got:  ${g}\n   want: ${w}`) }
}
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.error(`✗ ${label}`) } }

// ── email normalization ───────────────────────────────────────────
eq('normalizeEmail trims+lowercases', normalizeEmail('  Foo@Bar.COM '), 'foo@bar.com')
eq('normalizeEmail handles undefined', normalizeEmail(undefined), '')
ok('isValidEmail accepts ok address', isValidEmail('a@b.co'))
ok('isValidEmail rejects no-tld', !isValidEmail('a@b'))
ok('isValidEmail rejects spaces', !isValidEmail('a b@c.com'))

// ── deterministic id (the core idempotency guarantee) ─────────────
const id1 = subscriberDocId('User@Example.com')
const id2 = subscriberDocId('  user@example.com ')
eq('same email (diff case/space) → same id', id1, id2)
ok('id has nl_ prefix', id1.startsWith('nl_'))
ok('different emails → different ids', subscriberDocId('a@x.com') !== subscriberDocId('b@x.com'))
ok('id is stable string length', id1.length === 'nl_'.length + 32)

// ── verdict bucketing ─────────────────────────────────────────────
eq('verdict scam', normalizeVerdict('likely scam'), 'scam')
eq('verdict suspicious', normalizeVerdict('suspicious'), 'suspicious')
eq('verdict needs_review→suspicious', normalizeVerdict('needs_review'), 'suspicious')
eq('verdict safe', normalizeVerdict('safe'), 'safe')
eq('verdict na→unknown', normalizeVerdict('na'), 'unknown')
eq('verdict missing→unknown', normalizeVerdict(undefined), 'unknown')

// ── device bucketing ──────────────────────────────────────────────
eq('device mobile', normalizeDevice('mobile'), 'mobile')
eq('device tablet', normalizeDevice('tablet'), 'tablet')
eq('device junk→desktop', normalizeDevice('toaster'), 'desktop')
eq('device missing→desktop', normalizeDevice(undefined), 'desktop')

// ── source normalization (strip legacy |verdict: tail) ────────────
eq('source strips verdict tail', normalizeSource('scan-result-quick|verdict:scam'), 'scan-result-quick')
eq('source empty→unknown', normalizeSource(''), 'unknown')

// ── aggregation + per-verdict conversion ──────────────────────────
const rows = [
  { verdict: 'scam', source: 'scan-result-quick', device: 'mobile', createdAt: '2026-06-01' },
  { verdict: 'scam', source: 'scan-result-quick', device: 'desktop', createdAt: '2026-06-02' },
  { verdict: 'suspicious', source: 'scan-result-screenshot', device: 'mobile', createdAt: '2026-06-03' },
  { verdict: 'safe', source: 'scan-result-quick', device: 'tablet', createdAt: '2026-06-04' },
  { verdict: undefined, source: 'blog-post', device: 'desktop', createdAt: '2026-06-05' }, // blog → unknown
]
const s = summarizeSubscribers(rows)
eq('total', s.total, 5)
eq('byVerdict', s.byVerdict, { scam: 2, safe: 1, suspicious: 1, unknown: 1 })
eq('byDevice', s.byDevice, { mobile: 2, tablet: 1, desktop: 2 })
eq('bySource', s.bySource, { 'scan-result-quick': 3, 'scan-result-screenshot': 1, 'blog-post': 1 })
eq('scanSourcedTotal excludes unknown', s.scanSourcedTotal, 4)
// conversion = share of scan-sourced (4): scam 2/4=50, safe 1/4=25, suspicious 1/4=25
eq('conversionByVerdict', s.conversionByVerdict, { scam: 50, safe: 25, suspicious: 25 })

// empty input must not divide-by-zero
const empty = summarizeSubscribers([])
eq('empty total', empty.total, 0)
eq('empty conversion all zero', empty.conversionByVerdict, { scam: 0, safe: 0, suspicious: 0 })

// ── store-backed idempotency simulation ───────────────────────────
// Mirrors the route's get-before-write flow against a Map keyed by the REAL
// deterministic doc id. Proves: same email (any case/spacing) → ONE record,
// second submit detected as existing (→ "already subscribed", no new doc, no
// re-email); different emails → distinct records.
function simulateSubscribe(store, rawEmail) {
  const email = normalizeEmail(rawEmail)
  if (!isValidEmail(email)) return { status: 400 }
  const id = subscriberDocId(email)
  if (store.has(id)) return { status: 200, duplicate: true, emailed: false }
  store.set(id, { email, createdAt: new Date().toISOString() })
  return { status: 200, duplicate: false, emailed: true }
}
const store = new Map()
const r1 = simulateSubscribe(store, 'Dup@Example.com')
const r2 = simulateSubscribe(store, '  dup@example.com ')   // same person, different formatting
const r3 = simulateSubscribe(store, 'someone-else@example.com')
ok('first submit creates + emails', r1.status === 200 && !r1.duplicate && r1.emailed)
ok('second submit is duplicate, no re-email', r2.status === 200 && r2.duplicate === true && r2.emailed === false)
eq('two submits of same email → ONE record', store.size, 2) // dup person (1) + someone-else (1)
ok('different email creates new record', r3.status === 200 && !r3.duplicate)
ok('invalid email rejected before write', simulateSubscribe(store, 'nope').status === 400)
eq('store unchanged after invalid', store.size, 2)

console.log(`\nnewsletter-idempotency: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
