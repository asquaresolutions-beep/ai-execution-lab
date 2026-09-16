// scripts/test-indexnow.mjs
// Unit tests for the IndexNow eligibility + delta engine. Pure; no network.
//   node --experimental-strip-types scripts/test-indexnow.mjs
import {
  staticCheck, liveCheck, isEligible, parseSitemap, isVolatileLastmod,
  toState, computeDelta, batchByHost, buildPayload,
  SUBMITTABLE_HOSTS, MAX_URLS_PER_REQUEST,
} from '../lib/seo/indexnow.ts'

let pass = 0
let fail = 0
const ok = (cond, name) => { if (cond) { pass++ } else { fail++; console.log(`    ✗ ${name}`) } }
const eq = (a, b, name) => ok(a === b, `${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`)

const SC = 'scamcheck.asquaresolution.com'
const TS = 'trustseal.asquaresolution.com'
const LAB = 'lab.asquaresolution.com'
const goodProbe = (u) => ({ status: 200, finalUrl: u, robots: 'index, follow', canonical: u })

console.log('— eligibility: the happy path')
{
  const u = `https://${SC}/whatsapp-scam-checker`
  eq(staticCheck(u, SC), null, 'valid URL passes static checks')
  eq(liveCheck(u, goodProbe(u)), null, 'valid URL passes live checks')
  ok(isEligible(u, SC, goodProbe(u)).eligible, '200 + self-canonical + indexable → accepted')
}

console.log('— live-state rejections')
{
  const u = `https://${SC}/whatsapp-scam-checker`
  eq(isEligible(u, SC, { ...goodProbe(u), robots: 'noindex, follow' }).reason, 'noindex', 'noindex → rejected')
  eq(isEligible(u, SC, { ...goodProbe(u), status: 301, finalUrl: `https://${SC}/other` }).reason, 'http-301', '301 → rejected')
  eq(isEligible(u, SC, { ...goodProbe(u), status: 302, finalUrl: `https://${SC}/other` }).reason, 'http-302', '302 → rejected')
  eq(isEligible(u, SC, { ...goodProbe(u), status: 404 }).reason, 'http-404', '404 → rejected')
  eq(isEligible(u, SC, { ...goodProbe(u), finalUrl: `https://${SC}/elsewhere` }).reason, 'redirect', 'redirected → rejected')
  eq(isEligible(u, SC, { ...goodProbe(u), canonical: `https://${SC}/different` }).reason, 'canonical-mismatch', 'canonical mismatch → rejected')
  eq(isEligible(u, SC, { ...goodProbe(u), canonical: `https://asquaresolution.com/x` }).reason, 'cross-host-canonical', 'cross-host canonical → rejected')
  eq(liveCheck(u, { ...goodProbe(u), canonical: `https://${TS}/whatsapp-scam-checker` }), 'cross-host-canonical', 'cross-host canonical detected when path matches')
  eq(isEligible(u, SC, { ...goodProbe(u), canonical: '' }).reason, 'no-canonical', 'missing canonical → rejected')
  eq(isEligible(u, SC).reason, 'no-live-probe', 'no probe → never eligible')
}

console.log('— route + host rejections')
{
  eq(staticCheck(`https://${SC}/embed/checker`, SC), 'excluded-route:/embed', '/embed/* → rejected')
  eq(staticCheck(`https://${SC}/api/scam-intel/quick-check`, SC), 'excluded-route:/api', '/api/* → rejected')
  eq(staticCheck(`https://${SC}/ops`, SC), 'excluded-route:/ops', '/ops → rejected')
  eq(staticCheck(`https://${SC}/syndicate`, SC), 'excluded-route:/syndicate', '/syndicate → rejected')
  eq(staticCheck(`https://${SC}/embedded-guide`, SC), null, '/embedded-guide is NOT treated as /embed')
  eq(staticCheck('http://localhost:3000/', 'localhost'), 'not-https', 'localhost http → rejected')
  eq(staticCheck('https://localhost/x', 'localhost'), 'non-production-host', 'localhost https → rejected')
  eq(staticCheck('https://ai-execution-abc.vercel.app/x', 'ai-execution-abc.vercel.app'), 'non-production-host', '*.vercel.app → rejected')
  eq(staticCheck(`https://${SC}/x#frag`, SC), 'has-fragment', 'fragment → rejected')
  eq(staticCheck(`https://${TS}/en`, SC), 'foreign-host', 'URL from another host → rejected for this batch')
}

console.log('— WordPress is unreachable from this implementation')
{
  const wp1 = 'https://asquaresolution.com/blog/ai-driven-fmcg-transformation-from-data-insights-to-smart-products-and-services/'
  const wp2 = 'https://asquaresolution.com/blog/digital-marketing-agencies-in-japan-ai-2025/'
  eq(staticCheck(wp1, SC), 'host-not-submittable', 'known WP redirect/noindex URL → rejected')
  eq(staticCheck(wp2, SC), 'host-not-submittable', 'known WP duplicate-canonical URL → rejected')
  eq(staticCheck(wp1, 'asquaresolution.com'), 'host-not-submittable', 'WP URL rejected even when asked for its own host')
  ok(!SUBMITTABLE_HOSTS.includes('asquaresolution.com'), 'asquaresolution.com is not a submittable host')
  // and it would still be rejected on live state alone
  eq(liveCheck(wp1, { status: 301, finalUrl: 'https://asquaresolution.com/blog/ai-in-fmcg/', robots: '', canonical: '' }), 'http-301', 'WP hazard also fails live checks')
}

console.log('— encoding')
{
  eq(staticCheck(`https://${LAB}/tags/REST API`, LAB), 'not-percent-encoded', 'unencoded space → rejected')
  eq(staticCheck(`https://${LAB}/tags/REST%20API`, LAB), null, 'percent-encoded form → accepted')
  eq(staticCheck('https://lab.asquaresolution.com/a b/c', LAB), 'not-percent-encoded', 'space mid-path → rejected')
  eq(staticCheck('not-a-url', LAB), 'unparseable-url', 'malformed URL → rejected')
}

console.log('— sitemap parsing')
{
  const xml = `<?xml version="1.0"?><urlset>
    <url><loc>https://${SC}/a</loc><lastmod>2026-09-16T05:00:00.000Z</lastmod></url>
    <url><loc>https://${SC}/b?x=1&amp;y=2</loc><lastmod>2026-01-02T00:00:00.000Z</lastmod></url>
    <url><loc>https://${SC}/c</loc></url></urlset>`
  const e = parseSitemap(xml)
  eq(e.length, 3, 'parses three entries')
  eq(e[1].loc, `https://${SC}/b?x=1&y=2`, 'decodes &amp; in loc')
  eq(e[2].lastmod, null, 'missing lastmod → null')
}

console.log('— volatile lastmod detection (app/sitemap.ts stamps request time)')
{
  const now = Date.parse('2026-09-16T12:00:00Z')
  ok(isVolatileLastmod('2026-09-16T11:59:30Z', now), 'stamp seconds before fetch → volatile')
  ok(!isVolatileLastmod('2026-07-01T00:00:00Z', now), 'real content date → not volatile')
  ok(!isVolatileLastmod(null, now), 'missing lastmod → not volatile')
  ok(!isVolatileLastmod('not-a-date', now), 'unparseable → not volatile')
}

console.log('— delta model')
{
  const t1 = Date.parse('2026-09-15T12:00:00Z')
  const t2 = Date.parse('2026-09-16T12:00:00Z')
  const base = toState([
    { loc: `https://${LAB}/keep`, lastmod: '2026-01-01T00:00:00Z' },
    { loc: `https://${LAB}/lesson`, lastmod: '2026-01-01T00:00:00Z' },
    { loc: `https://${LAB}/volatile`, lastmod: '2026-09-15T11:59:00Z' },
    { loc: `https://${LAB}/gone`, lastmod: '2026-01-01T00:00:00Z' },
  ], t1)
  const cur = toState([
    { loc: `https://${LAB}/keep`, lastmod: '2026-01-01T00:00:00Z' },
    { loc: `https://${LAB}/lesson`, lastmod: '2026-09-10T00:00:00Z' },
    { loc: `https://${LAB}/volatile`, lastmod: '2026-09-16T11:59:00Z' },
    { loc: `https://${LAB}/brand-new`, lastmod: '2026-09-16T11:59:00Z' },
  ], t2)
  const d = computeDelta(base, cur)
  eq(d.added.join(), `https://${LAB}/brand-new`, 'new URL → added')
  eq(d.changed.join(), `https://${LAB}/lesson`, 'real lastmod change → changed')
  eq(d.unchanged.join(), `https://${LAB}/keep`, 'identical lastmod → unchanged, not submitted')
  eq(d.ignoredVolatile.join(), `https://${LAB}/volatile`, 'request-time stamp change → ignored, not submitted')
  eq(d.removed.join(), `https://${LAB}/gone`, 'dropped URL → removed')

  const seed = computeDelta(null, cur)
  eq(seed.added.length, 0, 'no baseline → nothing added')
  eq(seed.changed.length, 0, 'no baseline → nothing changed (first run submits nothing)')
}

console.log('— batching')
{
  const many = Array.from({ length: 250 }, (_, i) => `https://${LAB}/p${i}`)
  const b = batchByHost(many)
  eq(b.length, 3, '250 URLs → 3 batches')
  ok(b.every((x) => x.urls.length <= MAX_URLS_PER_REQUEST), 'no batch exceeds 100')
  eq(b[0].urls.length, 100, 'first batch is full')
  eq(b[2].urls.length, 50, 'last batch holds the remainder')

  const mixed = [`https://${LAB}/a`, `https://${SC}/b`, `https://${TS}/c`, `https://${LAB}/d`]
  const mb = batchByHost(mixed)
  eq(mb.length, 3, 'three hosts → three batches')
  ok(mb.every((x) => x.urls.every((u) => new URL(u).hostname === x.host)), 'hosts never mix within a batch')
  const payload = buildPayload(mb[0], 'k'.repeat(32), `https://${mb[0].host}/key.txt`)
  ok(payload.host && payload.key && payload.keyLocation && Array.isArray(payload.urlList), 'payload has host/key/keyLocation/urlList')
  eq(new URL(payload.keyLocation).hostname, payload.host, 'keyLocation is on the submitted host')
}

console.log(`\nindexnow: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
