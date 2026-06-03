#!/usr/bin/env node
// Build the real-image scam corpus at scale (goals 1-3, 9). Reads a directory
// of real screenshots, streams each to the live admin corpus-ingest endpoint
// (which runs OCR + Gemini vision + fingerprint + embed + BigQuery store), with
// bounded concurrency, dedup, and live cost tracking. No mocks — requires a
// deployed instance + admin token.
//   SCAMCHECK_URL=https://... ADMIN_API_TOKEN=... node scripts/build-scam-corpus.mjs ./datasets/real-images
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const URL = process.env.SCAMCHECK_URL
const TOKEN = process.env.ADMIN_API_TOKEN
const DIR = process.argv[2] || './datasets/real-images'
if (!URL || !TOKEN) { console.error('Set SCAMCHECK_URL and ADMIN_API_TOKEN. (Live ingestion requires a deployed instance.)'); process.exit(2) }

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
let files = []
try { files = readdirSync(DIR).filter((f) => MIME[extname(f).toLowerCase()] && statSync(join(DIR, f)).size <= 6 * 1024 * 1024) }
catch { console.error(`Directory ${DIR} not found. Place real screenshots there (png/jpeg/webp, <=6MB).`); process.exit(2) }
if (!files.length) { console.error(`No images in ${DIR}.`); process.exit(2) }

const CONCURRENCY = Number(process.env.INGEST_CONCURRENCY || 5)
console.log(`Ingesting ${files.length} images from ${DIR} (concurrency ${CONCURRENCY}) → ${URL}/api/scam-intel/corpus-ingest\n`)

const stats = { ok: 0, fail: 0, cost: 0, byVerdict: {}, byCampaign: {} }
async function ingest(file) {
  const buf = readFileSync(join(DIR, file))
  const body = JSON.stringify({ imageBase64: buf.toString('base64'), mime: MIME[extname(file).toLowerCase()] })
  try {
    const r = await fetch(`${URL}/api/scam-intel/corpus-ingest`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }, body })
    const j = await r.json()
    if (!r.ok) { stats.fail++; console.log(`✗ ${file}: ${j.error || r.status}`); return }
    stats.ok++; stats.cost += j.estCostUsd || 0
    stats.byVerdict[j.verdict] = (stats.byVerdict[j.verdict] || 0) + 1
    stats.byCampaign[j.campaignLabel] = (stats.byCampaign[j.campaignLabel] || 0) + 1
    console.log(`✓ ${file}: ${j.verdict} risk=${j.riskScore} [${j.campaignLabel}] ~$${(j.estCostUsd || 0).toFixed(5)}`)
  } catch (e) { stats.fail++; console.log(`✗ ${file}: ${String(e).slice(0, 60)}`) }
}

// Bounded-concurrency worker pool.
let idx = 0
async function worker() { while (idx < files.length) { const i = idx++; await ingest(files[i]) } }
const t0 = Date.now()
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

console.log(`\n── Ingestion complete ──`)
console.log(`ok=${stats.ok} fail=${stats.fail} in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
console.log(`verdicts:`, stats.byVerdict)
console.log(`top campaigns:`, Object.entries(stats.byCampaign).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k}(${n})`).join(', '))
console.log(`estimated Vertex/OCR cost: ~$${stats.cost.toFixed(4)} (₹${(stats.cost * 83).toFixed(2)}) — duplicates served from cache at ~$0`)
console.log(`\nNext: GET ${URL}/api/scam-intel/leaderboard and /api/scam-intel/dashboard for live analytics.`)
