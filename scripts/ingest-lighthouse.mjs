#!/usr/bin/env node
/**
 * scripts/ingest-lighthouse.mjs
 * Phase 2 — Lighthouse Performance Ingestion
 *
 * Runs Lighthouse audits against key platform pages using the PageSpeed
 * Insights API (free, no Chrome required) and appends results to
 * data/telemetry/lighthouse.json.
 *
 * Usage:
 *   node scripts/ingest-lighthouse.mjs
 *
 * Optional env var:
 *   PAGESPEED_API_KEY — Google PageSpeed API key (increases rate limit)
 *                       Get one: https://console.cloud.google.com/
 *
 * Pages audited (configurable below):
 *   / (homepage), /ops, /tracks, /failures, /case-studies
 *
 * Output: data/telemetry/lighthouse.json
 * Note: Each run APPENDS to the runs array (keeps history). Truncates at 50.
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_FILE  = path.join(ROOT, 'data', 'telemetry', 'lighthouse.json')

// ── Load env ─────────────────────────────────────────────────────────────────

function loadEnv() {
  const envFile = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envFile)) return
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnv()

// ── Config ───────────────────────────────────────────────────────────────────

const API_KEY = process.env.PAGESPEED_API_KEY ?? ''
const BASE_URL = 'https://lab.asquaresolution.com'

const PAGES = [
  { path: '/',            label: 'Homepage'    },
  { path: '/ops',         label: 'Ops'         },
  { path: '/tracks',      label: 'Tracks'      },
  { path: '/failures',    label: 'Failures'    },
  { path: '/case-studies', label: 'Case Studies' },
]

const PSI_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

// ── Fetch PSI ─────────────────────────────────────────────────────────────────

async function runPSI(pageUrl) {
  const params = new URLSearchParams({
    url:      pageUrl,
    strategy: 'mobile',   // mobile is the primary Google signal
    ...(API_KEY ? { key: API_KEY } : {}),
  })

  const res  = await fetch(`${PSI_BASE}?${params}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PSI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

// ── Transform ────────────────────────────────────────────────────────────────

function transform(data, label) {
  const cats    = data.lighthouseResult?.categories  ?? {}
  const audits  = data.lighthouseResult?.audits      ?? {}

  const score = key => Math.round((cats[key]?.score ?? 0) * 100)
  const ms    = key => {
    const v = audits[key]?.numericValue
    return v != null ? Math.round(v) : null
  }

  return {
    url:    data.id,
    label,
    runAt:  new Date().toISOString(),
    scores: {
      performance:   score('performance'),
      accessibility: score('accessibility'),
      bestPractices: score('best-practices'),
      seo:           score('seo'),
    },
    metrics: {
      fcp:  ms('first-contentful-paint'),
      lcp:  ms('largest-contentful-paint'),
      tbt:  ms('total-blocking-time'),
      cls:  audits['cumulative-layout-shift']?.numericValue ?? null,
      ttfb: ms('server-response-time'),
    },
  }
}

// ── Load existing snapshot ───────────────────────────────────────────────────

function loadExisting() {
  try {
    if (fs.existsSync(OUT_FILE)) {
      return JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'))
    }
  } catch {}
  return { _meta: { lastUpdated: '' }, runs: [] }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const existing = loadExisting()
  const newRuns  = []

  for (const page of PAGES) {
    const url = `${BASE_URL}${page.path}`
    console.log(`[ingest-lighthouse] Auditing: ${url}`)
    try {
      const data   = await runPSI(url)
      const result = transform(data, page.label)
      newRuns.push(result)
      const s = result.scores
      console.log(
        `  perf:${s.performance} a11y:${s.accessibility} seo:${s.seo}`
      )
      // PSI rate limit: 1 req/2s without API key
      if (!API_KEY) await new Promise(r => setTimeout(r, 2500))
    } catch (err) {
      console.warn(`  [SKIP] ${err.message}`)
    }
  }

  // Prepend new runs, keep latest 50
  const allRuns = [...newRuns, ...(existing.runs ?? [])].slice(0, 50)

  const snapshot = {
    _meta: {
      source:      'lighthouse',
      lastUpdated: new Date().toISOString(),
      runsKept:    allRuns.length,
    },
    runs: allRuns,
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2))
  console.log(`[ingest-lighthouse] ✓ Wrote ${newRuns.length} new runs (${allRuns.length} total)`)
}

run().catch(err => {
  console.error('[ingest-lighthouse] FATAL:', err)
  process.exit(1)
})
