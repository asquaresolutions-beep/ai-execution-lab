#!/usr/bin/env node
/**
 * scripts/ingest-uptime.mjs
 * Phase 2 — Uptime / Availability Check
 *
 * Performs HTTP HEAD checks against all ecosystem properties and writes
 * results to data/telemetry/uptime.json.
 *
 * Usage:
 *   node scripts/ingest-uptime.mjs
 *
 * Output: data/telemetry/uptime.json
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_FILE  = path.join(ROOT, 'data', 'telemetry', 'uptime.json')

// ── Properties to check ───────────────────────────────────────────────────────

const PROPERTIES = [
  { property: 'A Square Solutions',  url: 'https://asquaresolution.com/' },
  { property: 'AI Execution Lab',    url: 'https://lab.asquaresolution.com/' },
  { property: 'TrustSeal',           url: 'https://trustseal.asquaresolution.com/' },
  { property: 'ScamCheck',           url: 'https://scamcheck.asquaresolution.com/' },
  { property: 'project subdomain',   url: 'https://project.asquaresolution.com/' },
]

const TIMEOUT_MS = 10_000

// ── Check ─────────────────────────────────────────────────────────────────────

async function check(property, url) {
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start      = Date.now()

  try {
    const res = await fetch(url, {
      method:  'HEAD',
      signal:  controller.signal,
      headers: { 'User-Agent': 'AEL-UptimeBot/1.0' },
      redirect: 'follow',
    })
    const latencyMs = Date.now() - start

    return {
      property,
      url,
      status:   res.ok ? 'up' : res.status >= 500 ? 'degraded' : 'up',
      httpCode: res.status,
      latencyMs,
      checkedAt: new Date().toISOString(),
    }
  } catch (err) {
    return {
      property,
      url,
      status:    'down',
      httpCode:  null,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
      error:     err.message,
    }
  } finally {
    clearTimeout(timer)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('[ingest-uptime] Checking ecosystem properties...')

  const checks = await Promise.all(
    PROPERTIES.map(p => check(p.property, p.url))
  )

  for (const c of checks) {
    const icon = c.status === 'up' ? '✓' : c.status === 'degraded' ? '⚠' : '✗'
    const lat  = c.latencyMs != null ? `${c.latencyMs}ms` : 'timeout'
    console.log(`  ${icon} ${c.property.padEnd(24)} ${c.httpCode ?? 'ERR'} — ${lat}`)
  }

  const snapshot = {
    _meta: {
      source:      'uptime-check',
      lastUpdated: new Date().toISOString(),
      count:       checks.length,
    },
    checks,
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2))
  console.log(`[ingest-uptime] ✓ Wrote ${checks.length} checks to ${OUT_FILE}`)

  const down = checks.filter(c => c.status !== 'up')
  if (down.length > 0) {
    console.warn(`[ingest-uptime] ⚠ ${down.length} properties down/degraded:`)
    down.forEach(c => console.warn(`  ${c.property}: ${c.status}`))
    process.exit(1)   // non-zero exit so CI can catch it
  }
}

run().catch(err => {
  console.error('[ingest-uptime] FATAL:', err)
  process.exit(1)
})
