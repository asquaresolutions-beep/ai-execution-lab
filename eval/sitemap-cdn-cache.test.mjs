// eval/sitemap-cdn-cache.test.mjs
//
// /sitemap.xml CDN cache header (PR #131 review, CodeRabbit finding 1).
//
// Bug: a path-wide next.config.mjs rule attached `Vercel-CDN-Cache-Control` to every
// /sitemap.xml response, including the degraded TrustSeal fallback that is returned when the
// Firestore ts_claims query fails, so the edge could keep serving a sitemap without any seal
// pages for up to the SWR window. The header now comes from app/sitemap.xml/route.ts, which
// knows whether the query succeeded.
//
// Calls the real route handler with each production Host header. Offline and side-effect
// free: in-memory stores injected through setStore (no STORE_FILE), and every fetch is
// recorded as a violation. Domains are fakes.
//
// Run: node --test --import ./eval/hooks.mjs eval/sitemap-cdn-cache.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

delete process.env.STORE_FILE
delete process.env.FIREBASE_PROJECT_ID
delete process.env.FIREBASE_API_KEY

const B = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '')
const imp = (p) => import(pathToFileURL(B + p).href)

const fetchCalls = []
globalThis.fetch = async (url) => { fetchCalls.push(String(url)); return new Response('{}', { status: 500 }) }

const { setStore } = await imp('lib/store/adapter.ts')
const { MemoryStore } = await imp('lib/store/memory-store.ts')
const { GET } = await imp('app/sitemap.xml/route.ts')

const CDN = 'max-age=300, stale-while-revalidate=3600'
const HOST = { lab: 'lab.asquaresolution.com', scamcheck: 'scamcheck.asquaresolution.com', trustseal: 'trustseal.asquaresolution.com' }

async function fetchSitemap(host) {
  const res = await GET(new Request(`https://${host}/sitemap.xml`, { headers: { host } }))
  const body = await res.text()
  const locs = [...body.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1])
  return { res, body, locs }
}

async function storeWith(claims) {
  const mem = new MemoryStore()
  for (const c of claims) await mem.set('ts_claims', c.id, c)
  return mem
}

/** A store whose every query fails, like Firestore being unreachable. */
function failingStore() {
  const mem = new MemoryStore()
  mem.query = async () => { throw new Error('simulated store outage (test only)') }
  return mem
}

function assertBaseHeaders(res) {
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'application/xml')
  assert.equal(res.headers.get('cache-control'), 'public, max-age=0, must-revalidate')
}

test('lab sitemap: success carries the 5-minute CDN cache and only lab URLs', async () => {
  setStore(await storeWith([]))
  const { res, locs } = await fetchSitemap(HOST.lab)
  assertBaseHeaders(res)
  assert.equal(res.headers.get('vercel-cdn-cache-control'), CDN)
  assert.ok(locs.length > 50, `expected the lab URL set, got ${locs.length}`)
  assert.ok(locs.every((u) => u.startsWith('https://lab.asquaresolution.com')))
})

test('scamcheck sitemap: success carries the 5-minute CDN cache and only scamcheck URLs', async () => {
  setStore(await storeWith([]))
  const { res, locs } = await fetchSitemap(HOST.scamcheck)
  assertBaseHeaders(res)
  assert.equal(res.headers.get('vercel-cdn-cache-control'), CDN)
  assert.ok(locs.length > 10)
  assert.ok(locs.every((u) => u.startsWith('https://scamcheck.asquaresolution.com')))
})

test('trustseal sitemap: successful query carries the CDN cache and lists verified seals only', async () => {
  setStore(await storeWith([
    { id: 'c1', domain: 'verified-a.example.test', status: 'verified' },
    { id: 'c2', domain: 'pending-b.example.test', status: 'pending' },
  ]))
  const { res, locs } = await fetchSitemap(HOST.trustseal)
  assertBaseHeaders(res)
  assert.equal(res.headers.get('vercel-cdn-cache-control'), CDN)
  const seals = locs.filter((u) => u.includes('/trust/'))
  assert.ok(seals.length > 0 && seals.every((u) => u.endsWith('/trust/verified-a.example.test')))
  assert.ok(locs.every((u) => u.startsWith('https://trustseal.asquaresolution.com')))
})

test('trustseal sitemap: a successful query with no verified claims is still cacheable', async () => {
  setStore(await storeWith([{ id: 'c3', domain: 'pending-c.example.test', status: 'pending' }]))
  const { res, locs } = await fetchSitemap(HOST.trustseal)
  assertBaseHeaders(res)
  assert.equal(res.headers.get('vercel-cdn-cache-control'), CDN)
  assert.equal(locs.filter((u) => u.includes('/trust/')).length, 0)
})

test('trustseal sitemap: failed query serves the static fallback WITHOUT the CDN cache header', async () => {
  setStore(await storeWith([{ id: 'c1', domain: 'verified-a.example.test', status: 'verified' }]))
  const ok = await fetchSitemap(HOST.trustseal)
  setStore(failingStore())
  const { res, locs } = await fetchSitemap(HOST.trustseal)
  assertBaseHeaders(res) // still 200 with the normal browser/crawler Cache-Control
  assert.equal(res.headers.get('vercel-cdn-cache-control'), null)
  assert.equal(locs.filter((u) => u.includes('/trust/')).length, 0)
  // The fallback is exactly the static part of the successful sitemap.
  assert.deepEqual(locs, ok.locs.filter((u) => !u.includes('/trust/')))
})

test('a store outage does not remove the CDN cache from lab or scamcheck', async () => {
  setStore(failingStore())
  for (const host of [HOST.lab, HOST.scamcheck]) {
    const { res } = await fetchSitemap(host)
    assertBaseHeaders(res)
    assert.equal(res.headers.get('vercel-cdn-cache-control'), CDN, host)
  }
})

test('host matching is case-insensitive, as before', async () => {
  setStore(failingStore())
  const { res, locs } = await fetchSitemap('TrustSeal.AsquareSolution.com')
  assert.equal(res.headers.get('vercel-cdn-cache-control'), null)
  assert.ok(locs.every((u) => u.startsWith('https://trustseal.asquaresolution.com')))
})

test('no network access', () => {
  assert.deepEqual(fetchCalls, [])
})
