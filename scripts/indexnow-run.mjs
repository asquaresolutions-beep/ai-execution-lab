// scripts/indexnow-run.mjs
// Deployment-delta IndexNow runner for the three Vercel-served hosts.
//
//   node --experimental-strip-types scripts/indexnow-run.mjs            # dry run (default)
//   node --experimental-strip-types scripts/indexnow-run.mjs --baseline <file>
//   node --experimental-strip-types scripts/indexnow-run.mjs --write-baseline <file>
//   node --experimental-strip-types scripts/indexnow-run.mjs --submit   # REAL POST (requires explicit approval)
//
// Dry run is the default and never contacts api.indexnow.org. WordPress is not
// handled here at all — asquaresolution.com is not a submittable host.
import fs from 'node:fs'
import {
  INDEXNOW_ENDPOINT, SUBMITTABLE_HOSTS, DEFAULT_RUN_CAP, MAX_URLS_PER_REQUEST,
  parseSitemap, toState, computeDelta, isEligible, batchByHost, buildPayload,
} from '../lib/seo/indexnow.ts'

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f, d = null) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }

const SUBMIT = has('--submit')
const CAP = Number(val('--cap', DEFAULT_RUN_CAP))
const BASELINE = val('--baseline')
const WRITE_BASELINE = val('--write-baseline')
const KEY_FILE = fs.readdirSync('public').find((f) => /^[0-9a-f]{32}\.txt$/.test(f))
if (!KEY_FILE) { console.error('No IndexNow key file found in public/. Aborting.'); process.exit(1) }
const KEY = fs.readFileSync(`public/${KEY_FILE}`, 'utf8').trim()

const UA = { 'user-agent': 'asq-indexnow-runner (+https://asquaresolution.com)' }

async function probe(url) {
  const r = await fetch(url, { headers: UA, redirect: 'follow' })
  const b = await r.text()
  const attr = (re) => {
    const m = b.match(re)
    if (!m) return ''
    const c = m[0].match(/(?:content|href)=["']([\s\S]*?)["']/i)
    return c ? c[1].trim() : ''
  }
  return { status: r.status, finalUrl: r.url, robots: attr(/<meta[^>]+name=["']robots["'][^>]*>/i), canonical: attr(/<link[^>]+rel=["']canonical["'][^>]*>/i) }
}

async function pool(items, n, fn) {
  const out = []
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]) } catch (e) { out[k] = { error: String(e?.message || e) } } }
  }))
  return out
}

const baseline = BASELINE && fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null
const stateOut = {}
const wouldSubmit = []

console.log(`IndexNow runner — mode: ${SUBMIT ? '*** LIVE SUBMIT ***' : 'DRY RUN (no network POST)'}`)
console.log(`key file: public/${KEY_FILE}  (key value not printed)`)
console.log(`baseline: ${baseline ? BASELINE : 'NONE — first run seeds state and submits nothing'}`)
console.log(`per-run cap: ${CAP} | max per request: ${MAX_URLS_PER_REQUEST}\n`)

for (const host of SUBMITTABLE_HOSTS) {
  const fetchedAt = Date.now()
  const xml = await (await fetch(`https://${host}/sitemap.xml`, { headers: UA })).text()
  const entries = parseSitemap(xml)
  const current = toState(entries, fetchedAt)
  stateOut[host] = current

  const delta = computeDelta(baseline?.[host] ?? null, current)
  const candidates = [...delta.added, ...delta.changed]

  // Validate EVERY sitemap URL live, to prove the filter works (Phase 5),
  // independently of which ones the delta would actually submit.
  const probes = await pool(entries.map((e) => e.loc), 6, async (u) => ({ u, p: await probe(u) }))
  const results = probes.map(({ u, p }) => isEligible(u, host, p.error ? undefined : p))
  const eligible = results.filter((r) => r.eligible).map((r) => r.url)
  const rejected = results.filter((r) => !r.eligible)
  const reasons = rejected.reduce((a, r) => ((a[r.reason] = (a[r.reason] || 0) + 1), a), {})

  const eligibleSet = new Set(eligible)
  const submitList = candidates.filter((u) => eligibleSet.has(u)).slice(0, CAP)
  wouldSubmit.push(...submitList)

  console.log(`▸ ${host}`)
  console.log(`   sitemap URLs (candidates validated): ${entries.length}`)
  console.log(`   eligible: ${eligible.length} | rejected: ${rejected.length}${rejected.length ? ` → ${JSON.stringify(reasons)}` : ''}`)
  for (const r of rejected.slice(0, 10)) console.log(`      ✗ ${r.reason.padEnd(22)} ${r.url}`)
  console.log(`   delta vs baseline: added ${delta.added.length} | changed ${delta.changed.length} | unchanged ${delta.unchanged.length} | lastmod ignored as volatile ${delta.ignoredVolatile.length} | removed ${delta.removed.length}`)
  console.log(`   WOULD SUBMIT: ${submitList.length}${submitList.length ? '\n' + submitList.map((u) => '        → ' + u).join('\n') : ''}`)
  const batches = batchByHost(submitList)
  console.log(`   batches: ${batches.length}${batches.map((b) => ` [${b.host}: ${b.urls.length}]`).join('')}\n`)

  if (SUBMIT && submitList.length) {
    for (const b of batches) {
      const payload = buildPayload(b, KEY, `https://${b.host}/${KEY_FILE}`)
      const res = await fetch(INDEXNOW_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload) })
      console.log(`   POST ${b.host} × ${b.urls.length} → HTTP ${res.status}`)
    }
  }
}

if (WRITE_BASELINE) {
  fs.writeFileSync(WRITE_BASELINE, JSON.stringify(stateOut, null, 1))
  console.log(`baseline state written to ${WRITE_BASELINE}`)
}
console.log(`\nTOTAL WOULD SUBMIT: ${wouldSubmit.length}`)
console.log(SUBMIT ? 'LIVE SUBMIT MODE WAS ENABLED' : 'No IndexNow POST was made (dry run).')
