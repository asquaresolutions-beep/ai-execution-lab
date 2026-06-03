#!/usr/bin/env node
/**
 * scripts/ingest-sitemap.mjs
 * Phase 2 — Sitemap Health Ingestion
 *
 * Fetches the platform sitemap, parses all URLs, and spot-checks HTTP status
 * for each. Writes results to data/telemetry/sitemap-health.json.
 *
 * Usage:
 *   node scripts/ingest-sitemap.mjs [--full] [--url <sitemap-url>]
 *
 * Options:
 *   --full     Check every URL (default: spot-checks up to 50)
 *   --url      Override sitemap URL (default: https://lab.asquaresolution.com/sitemap.xml)
 *
 * Output: data/telemetry/sitemap-health.json
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_FILE  = path.join(ROOT, 'data', 'telemetry', 'sitemap-health.json')

// ── Args ─────────────────────────────────────────────────────────────────────

const args       = process.argv.slice(2)
const FULL_CHECK = args.includes('--full')
const urlIdx     = args.indexOf('--url')
const SITEMAP_URL = urlIdx !== -1 && args[urlIdx + 1]
  ? args[urlIdx + 1]
  : 'https://lab.asquaresolution.com/sitemap.xml'

const MAX_CHECKS = FULL_CHECK ? Infinity : 50
const CONCURRENCY = 8   // parallel fetch limit
const TIMEOUT_MS  = 8000

// ── Fetch with timeout ───────────────────────────────────────────────────────

async function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const start  = Date.now()
  try {
    const res = await fetch(url, {
      method:  'HEAD',
      signal:  controller.signal,
      headers: { 'User-Agent': 'AEL-SitemapHealthBot/1.0' },
      redirect: 'follow',
    })
    return { status: res.status, latencyMs: Date.now() - start, ok: res.ok }
  } catch (err) {
    return { status: null, latencyMs: null, ok: false, error: err.message }
  } finally {
    clearTimeout(timer)
  }
}

// ── Parse sitemap XML ────────────────────────────────────────────────────────

function parseUrlsFromXml(xml) {
  const urls = []
  const locRegex = /<loc>([^<]+)<\/loc>/g
  let m
  while ((m = locRegex.exec(xml)) !== null) {
    urls.push(m[1].trim())
  }
  return urls
}

// ── Check URLs in batches ────────────────────────────────────────────────────

async function checkUrlBatch(urls) {
  const results = []
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY)
    const checks = await Promise.all(batch.map(async url => {
      const result = await fetchWithTimeout(url)
      process.stdout.write(result.ok ? '.' : 'F')
      return {
        url,
        status:    result.status,
        ok:        result.ok,
        latencyMs: result.latencyMs,
        checkedAt: new Date().toISOString(),
      }
    }))
    results.push(...checks)
  }
  process.stdout.write('\n')
  return results
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`[ingest-sitemap] Fetching sitemap: ${SITEMAP_URL}`)

  // 1. Fetch sitemap
  let sitemapStatus = null
  let xml = ''
  try {
    const res = await fetch(SITEMAP_URL, {
      headers: { 'User-Agent': 'AEL-SitemapHealthBot/1.0' },
    })
    sitemapStatus = res.status
    if (res.ok) {
      xml = await res.text()
    }
  } catch (err) {
    console.error('[ingest-sitemap] Failed to fetch sitemap:', err.message)
  }

  // 2. Parse URLs
  const allUrls = parseUrlsFromXml(xml)
  console.log(`[ingest-sitemap] Found ${allUrls.length} URLs`)

  // 3. Sample or full check
  const toCheck = allUrls.slice(0, MAX_CHECKS === Infinity ? undefined : MAX_CHECKS)
  console.log(`[ingest-sitemap] Checking ${toCheck.length} URLs (${FULL_CHECK ? 'full' : 'spot-check'})...`)

  const results = toCheck.length > 0 ? await checkUrlBatch(toCheck) : []

  const passing = results.filter(r => r.ok).length
  const failing = results.filter(r => !r.ok).length

  // 4. Write snapshot
  const snapshot = {
    _meta: {
      source:      'sitemap-check',
      lastUpdated: new Date().toISOString(),
      mode:        FULL_CHECK ? 'full' : 'spot-check',
    },
    sitemapUrl:  SITEMAP_URL,
    httpStatus:  sitemapStatus,
    totalUrls:   allUrls.length,
    checkedUrls: results.length,
    passing,
    failing,
    errors:      results.filter(r => !r.ok).map(r => `${r.status ?? 'ERR'} — ${r.url}`),
    results,
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2))

  const passRate = results.length > 0
    ? Math.round((passing / results.length) * 100)
    : 0

  console.log(`[ingest-sitemap] ✓ ${passing}/${results.length} URLs passing (${passRate}%)`)
  if (failing > 0) {
    console.warn(`[ingest-sitemap] ⚠ ${failing} failing URLs:`)
    results.filter(r => !r.ok).forEach(r => {
      console.warn(`  ${r.status ?? 'ERR'} — ${r.url}`)
    })
  }
}

run().catch(err => {
  console.error('[ingest-sitemap] FATAL:', err)
  process.exit(1)
})
