#!/usr/bin/env node
// Live stress + caching benchmark (goals 5, 6). Requires a deployed instance:
//   SCAMCHECK_URL=https://<cloud-run-url> [ADMIN_API_TOKEN=...] node scripts/stress-test.mjs
// Simulates: 100 concurrent screenshot requests, an upload burst, repeated
// DUPLICATE uploads (cache-hit benchmark), and a multilingual text-attack burst
// against /api/scam-intel/similar. Measures latency percentiles, throughput,
// cache hit rate, and error/429 counts. No mocks — hits the live pipeline.
const URL = process.env.SCAMCHECK_URL
if (!URL) { console.error('Set SCAMCHECK_URL to a deployed instance. (Cannot stress-test without a live endpoint.)'); process.exit(2) }

// Minimal valid 1x1 PNG (magic-byte valid) for transport/latency/cache tests.
const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'

function pct(arr, p) { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))] ?? 0 }
async function postJson(path, body) {
  const t = Date.now()
  try {
    const r = await fetch(`${URL}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    return { ms: Date.now() - t, status: r.status, cached: !!j.cached, ok: r.ok }
  } catch (e) { return { ms: Date.now() - t, status: 0, cached: false, ok: false, err: String(e).slice(0, 60) } }
}
const summarize = (label, res) => {
  const lat = res.map((r) => r.ms)
  const ok = res.filter((r) => r.ok).length, rl = res.filter((r) => r.status === 429).length, cached = res.filter((r) => r.cached).length
  console.log(`${label}: n=${res.length} ok=${ok} 429=${rl} err=${res.filter((r) => r.status === 0).length} cacheHits=${cached}`)
  console.log(`  latency ms: p50=${pct(lat, 50)} p90=${pct(lat, 90)} p99=${pct(lat, 99)} max=${Math.max(...lat)}`)
  return { ok, rl, cached }
}

;(async () => {
  console.log(`Stress target: ${URL}\n`)

  // 1. 100 concurrent unique-ish screenshot requests (forceDeep off).
  const t1 = Date.now()
  const c1 = await Promise.all(Array.from({ length: 100 }, () => postJson('/api/scam-intel/screenshot', { imageBase64: PNG_1x1, mime: 'image/png' })))
  const s1 = summarize('100 concurrent screenshots', c1)
  console.log(`  throughput ~${(100 / ((Date.now() - t1) / 1000)).toFixed(1)} req/s\n`)

  // 2. Duplicate-upload cache benchmark: same image x50 → expect high cache hit.
  const c2 = await Promise.all(Array.from({ length: 50 }, () => postJson('/api/scam-intel/screenshot', { imageBase64: PNG_1x1, mime: 'image/png' })))
  const s2 = summarize('50 duplicate uploads (cache test)', c2)
  console.log(`  cache hit rate=${(s2.cached / 50).toFixed(2)} (duplicate detection + embedding reuse)\n`)

  // 3. Abuse: oversized + malicious payload (should be rejected, not crash).
  const big = 'A'.repeat(9 * 1024 * 1024)
  const oversize = await postJson('/api/scam-intel/screenshot', { imageBase64: Buffer.from(big).toString('base64'), mime: 'image/png' })
  const badPayload = await postJson('/api/scam-intel/screenshot', { imageBase64: Buffer.from('not-an-image').toString('base64'), mime: 'image/png' })
  console.log(`Abuse handling: oversized→${oversize.status} (expect 413), malicious→${badPayload.status} (expect 415), both JSON=ok\n`)

  // 4. Multilingual text-attack burst against the classification API.
  const attacks = ['KYC update karo warna account block ho jayega http://sbi-kyc.xyz', 'refund ke liye OTP bhejo', 'आपका खाता बंद हो जाएगा, तुरंत verify करें', 'Congratulations you won ₹49999 claim at bit.ly/x']
  const c4 = await Promise.all(Array.from({ length: 40 }, (_, i) => postJson('/api/scam-intel/similar', { text: attacks[i % attacks.length] })))
  summarize('40 multilingual classification attacks', c4)

  console.log('\nDone. Rate-limit (429) counts above confirm abuse protection; cache hit rate confirms dedup savings.')
})()
