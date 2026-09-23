// eval/scan-link-source.test.mjs
//
// Tagged-link scan attribution. A Square Solutions pages link to ScamCheck with the
// UTM tags they already carry; the analyzer now derives `${utm_source}.${utm_campaign}`
// for the server-side funnel log when no embed `source` is present. These tests pin:
//   (a) the real WordPress link shapes → `blog.<campaign>`
//   (b) hostile / invalid input stays inside scan-log's sanitizer (≤64, [a-z0-9._-])
//   (c) untagged URLs → nothing sent → the server's unchanged 'unknown' fallback
//   (d) embed routes keep their own `source` (precedence) and embed files are untouched
//   (e) the newsletter capture keeps its fixed source tag
//   (f) GA4 trackEvent params are unchanged (the fallback feeds ONLY the scan request)
// plus the server-side counter path end to end on a MemoryStore (no Firestore).
//
// Offline: no network, no production store.
// Run: node --test --import ./eval/hooks.mjs eval/scan-link-source.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)
const src = (p) => readFileSync(B + p, 'utf8')

const { linkSourceFromSearch } = await imp('lib/scam-intel/link-source.ts')
const { slug, logScanEvent, metricDay, SCAN_METRICS } = await imp('lib/scam-intel/scan-log.ts')
const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')

const SAFE = /^[a-z0-9._-]{1,64}$/
// What the server finally records for a given client value (scan-log's own sanitizer).
const recorded = (search) => slug(linkSourceFromSearch(search))

// ── (a) real WordPress link shapes (query strings as served on 23 Sep 2026) ──
const WP_LINKS = [
  ['?utm_source=blog&utm_medium=cta&utm_campaign=fake-apple-pay-payment-screenshot', 'blog.fake-apple-pay-payment-screenshot'],
  ['?utm_source=blog&utm_medium=cta&utm_campaign=fake-paytm-payment-screenshot', 'blog.fake-paytm-payment-screenshot'],
  ['?utm_source=blog&utm_medium=cta&utm_campaign=fake-phonepe-payment-screenshot', 'blog.fake-phonepe-payment-screenshot'],
  ['?utm_source=blog&utm_medium=cta&utm_campaign=fake-payment-screenshot', 'blog.fake-payment-screenshot'],
  ['?utm_source=blog&utm_medium=cta&utm_campaign=facebook-marketplace-fake-payment-scam', 'blog.facebook-marketplace-fake-payment-scam'],
  ['?utm_source=blog&utm_medium=cta&utm_campaign=fake_upi', 'blog.fake_upi'],
  ['?utm_source=blog&utm_medium=cta_top&utm_campaign=fake_upi', 'blog.fake_upi'],
  ['?utm_source=blog&utm_medium=cta_mid&utm_campaign=fake_upi', 'blog.fake_upi'],
  ['?utm_source=blog&utm_medium=faq&utm_campaign=fake_upi', 'blog.fake_upi'],
  ['?utm_source=blog&utm_medium=cta_scamcheck&utm_campaign=revsprint_26629', 'blog.revsprint_26629'],
]
for (const [search, want] of WP_LINKS) {
  test(`(a) WordPress link ${search.slice(0, 60)}… → ${want}`, () => {
    assert.equal(linkSourceFromSearch(search), want)
    assert.equal(recorded(search), want, 'survives scan-log slug() unchanged')
    assert.match(want, SAFE)
  })
}

test('(a) utm_medium does not affect the recorded source (not stored)', () => {
  const vals = ['cta', 'cta_top', 'cta_mid', 'faq'].map((m) => recorded(`?utm_source=blog&utm_medium=${m}&utm_campaign=fake_upi`))
  assert.deepEqual(new Set(vals), new Set(['blog.fake_upi']))
})

test('(a) the "blog." namespace never collides with an embed source (bare page slug, no ".")', () => {
  for (const [search] of WP_LINKS) assert.ok(recorded(search).startsWith('blog.'))
  for (const embed of ['fake-upi-payment-screenshot-scam', 'fake-payment-screenshot', 'fake-paytm-payment-screenshot', 'embed', 'unknown']) {
    assert.ok(!slug(embed).includes('.'), `embed source ${embed} has no namespace dot`)
  }
})

test('(a) a missing utm_source falls back to the "utm." namespace', () => {
  assert.equal(linkSourceFromSearch('?utm_campaign=fake-venmo-payment-screenshot'), 'utm.fake-venmo-payment-screenshot')
})

// ── (b) hostile / invalid input ─────────────────────────────────────────────
const HOSTILE = [
  '?utm_source=blog&utm_campaign=<script>alert(1)</script>',
  '?utm_source=blog&utm_campaign=../../etc/passwd',
  '?utm_source=blog&utm_campaign=fake%20upi%20page',
  '?utm_source=blog&utm_campaign=ƒaké-ûpi',
  '?utm_source=blog&utm_campaign=%00%0d%0a__x__',
  '?utm_source=<b>x</b>&utm_campaign=ok',
  '?utm_source=blog&utm_campaign=%E0%A4%A',
  `?utm_source=blog&utm_campaign=${'a'.repeat(300)}`,
  `?utm_source=${'s'.repeat(300)}&utm_campaign=c`,
  '%%%%', '?&&&==', '?utm_campaign', '?utm_campaign=%', 'utm_campaign=no-question-mark',
]
for (const search of HOSTILE) {
  test(`(b) hostile input never escapes the sanitizer: ${JSON.stringify(search).slice(0, 50)}`, () => {
    let out
    assert.doesNotThrow(() => { out = linkSourceFromSearch(search) })
    const rec = slug(out)
    assert.match(rec, SAFE, `recorded value ${JSON.stringify(rec)} must be ≤64 chars of [a-z0-9._-]`)
    assert.ok(rec.length <= 64)
  })
}

// ── (c) untagged URLs → nothing sent → server keeps logging 'unknown' ───────
for (const search of ['', '?', '?utm_source=blog', '?utm_source=blog&utm_medium=cta', '?utm_campaign=', '?utm_campaign=%20%20', '?src=fake-upi-payment-screenshot-scam', '?q=venmo']) {
  test(`(c) untagged ${JSON.stringify(search)} → undefined → recorded as 'unknown'`, () => {
    assert.equal(linkSourceFromSearch(search), undefined)
    assert.equal(recorded(search), 'unknown')
  })
}

// ── (d) embed behaviour is unchanged ────────────────────────────────────────
test('(d) the analyzer gives an embed `source` precedence over any URL tag', () => {
  const a = src('components/scamcheck/screenshot-analyzer.tsx')
  assert.match(a, /const logSource = source \|\| \(typeof window !== 'undefined' \? linkSourceFromSearch\(window\.location\.search\) : undefined\)/)
})

test('(d) embed route, embed beacon and the scan API contract are untouched', () => {
  assert.match(src('app/embed/checker/page.tsx'), /<ScreenshotAnalyzer source=\{source \|\| 'embed'\} \/>/)
  assert.ok(!/link-source/.test(src('app/embed/checker/page.tsx')))
  assert.ok(!/link-source/.test(src('components/scamcheck/embed-analytics.tsx')))
  const route = src('app/api/scam-intel/screenshot/route.ts')
  assert.match(route, /form\.get\('embed_source'\)/)
  assert.match(route, /body\.embed_source/)
  assert.ok(!/link-source|utm_/.test(route), 'the API route derives nothing from UTM tags itself')
})

test('(d) static routes still render the analyzer without reading searchParams', () => {
  for (const f of ['app/[slug]/page.tsx', 'app/scamcheck/screenshot/page.tsx', 'app/scamcheck/page.tsx']) {
    const s = src(f)
    assert.ok(!/useSearchParams|link-source/.test(s), `${f} unchanged`)
  }
  assert.match(src('app/[slug]/page.tsx'), /export const dynamicParams = false/)
})

// ── (e) newsletter source behaviour is unchanged ────────────────────────────
test('(e) the result-panel newsletter capture keeps its fixed source tag', () => {
  const a = src('components/scamcheck/screenshot-analyzer.tsx')
  assert.match(a, /<NewsletterCapture verdict=\{result\.verdict\} source="scan-result-screenshot"/)
  assert.ok(!/link-source|logSource/.test(src('components/scamcheck/newsletter-capture.tsx')))
})

// ── (f) GA4 behaviour is unchanged ──────────────────────────────────────────
test('(f) both GA4 trackEvent calls still use the embed `source` prop only', () => {
  const a = src('components/scamcheck/screenshot-analyzer.tsx')
  const calls = a.match(/trackEvent\('scan_(start|complete)'[^\n]*\)/g) || []
  assert.equal(calls.length, 2)
  for (const c of calls) {
    assert.match(c, /\.\.\.\(source \? \{ embed_source: source \} : \{\}\)/)
    assert.ok(!/logSource/.test(c), 'the UTM fallback must never reach GA4')
  }
  // logSource appears exactly 3 times: its declaration + the 2 references in the request-body spread.
  assert.equal((a.match(/logSource/g) || []).length, 3, 'declaration + 2 uses in the request body spread')
  assert.match(a, /\.\.\.\(logSource \? \{ embed_source: logSource \} : \{\}\)/)
})

// ── server-side counter path, end to end on a MemoryStore ───────────────────
test('a tagged-link scan lands in its own namespaced counter; embed counters are separate', async () => {
  const store = new MemoryStore()
  setStore(store)
  const day = metricDay()
  await logScanEvent('scan_start', { embedSource: linkSourceFromSearch('?utm_source=blog&utm_medium=cta&utm_campaign=fake-payment-screenshot') })
  await logScanEvent('scan_complete', { embedSource: linkSourceFromSearch('?utm_source=blog&utm_medium=cta&utm_campaign=fake-payment-screenshot'), verdict: 'likely_fake', riskScore: 80 })
  await logScanEvent('scan_start', { embedSource: 'fake-payment-screenshot' }) // an embed scan on the same page
  await logScanEvent('scan_start', { embedSource: linkSourceFromSearch('') })   // untagged arrival

  const link = await store.get(SCAN_METRICS, `${day}__blog.fake-payment-screenshot__scan_start`)
  const linkDone = await store.get(SCAN_METRICS, `${day}__blog.fake-payment-screenshot__scan_complete`)
  const embed = await store.get(SCAN_METRICS, `${day}__fake-payment-screenshot__scan_start`)
  const unknown = await store.get(SCAN_METRICS, `${day}__unknown__scan_start`)
  assert.equal(link?.data.count, 1); assert.equal(link?.data.source, 'blog.fake-payment-screenshot')
  assert.equal(linkDone?.data.count, 1)
  assert.equal(embed?.data.count, 1, 'the embed counter is not inflated by the text-link scan')
  assert.equal(unknown?.data.count, 1, 'untagged arrivals still fall back to unknown')
})
