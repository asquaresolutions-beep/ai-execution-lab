#!/usr/bin/env node
/**
 * scripts/ingest-gsc.mjs
 * Phase 2 — Google Search Console CSV Ingestion
 *
 * Parses a GSC Performance export CSV and writes structured data to
 * data/telemetry/gsc.json.
 *
 * Usage:
 *   node scripts/ingest-gsc.mjs <path/to/gsc-export.csv> [--type queries|pages]
 *
 * How to export from GSC:
 *   1. GSC → Performance → Search Results
 *   2. Set date range (recommended: last 28 days)
 *   3. Click "Export" → Download CSV
 *   4. Run this script with the downloaded file path
 *
 * GSC CSV format (Google's standard export):
 *   Top queries:  query, clicks, impressions, ctr, position
 *   Top pages:    page, clicks, impressions, ctr, position
 *
 * Output: data/telemetry/gsc.json
 * Note: Merges into existing snapshot — updates matching section only.
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_FILE  = path.join(ROOT, 'data', 'telemetry', 'gsc.json')

// ── Args ─────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2)
const csvPath = args.find(a => !a.startsWith('--'))
const typeIdx = args.indexOf('--type')
const forceType = typeIdx !== -1 ? args[typeIdx + 1] : null   // 'queries' | 'pages'

if (!csvPath) {
  console.error('[ingest-gsc] Usage: node scripts/ingest-gsc.mjs <path/to/export.csv> [--type queries|pages]')
  process.exit(1)
}

if (!fs.existsSync(csvPath)) {
  console.error(`[ingest-gsc] File not found: ${csvPath}`)
  process.exit(1)
}

// ── Parse CSV ─────────────────────────────────────────────────────────────────

function parseCsv(raw) {
  const lines  = raw.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[" ]/g, ''))
  const rows    = lines.slice(1).map(line => {
    // Handle quoted fields
    const cells = []
    let current = ''
    let inQuote = false
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { cells.push(current.trim()); current = ''; continue }
      current += ch
    }
    cells.push(current.trim())

    const row = {}
    headers.forEach((h, i) => { row[h] = cells[i] ?? '' })
    return row
  })

  return { headers, rows }
}

function toNum(val) {
  if (!val) return 0
  return parseFloat(val.toString().replace('%', '')) || 0
}

function detectType(headers) {
  if (headers.includes('query'))   return 'queries'
  if (headers.includes('page'))    return 'pages'
  return null
}

// ── Load existing ─────────────────────────────────────────────────────────────

function loadExisting() {
  try {
    if (fs.existsSync(OUT_FILE)) {
      return JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'))
    }
  } catch {}
  return {
    _meta:            { lastUpdated: '' },
    property:         'https://lab.asquaresolution.com',
    dateRange:        null,
    totalClicks:      0,
    totalImpressions: 0,
    avgCtr:           0,
    avgPosition:      0,
    topQueries:       [],
    topPages:         [],
    indexingIssues:   [],
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function run() {
  const raw         = fs.readFileSync(csvPath, 'utf-8')
  const { headers, rows } = parseCsv(raw)
  const type        = forceType ?? detectType(headers)

  if (!type) {
    console.error(`[ingest-gsc] Could not detect type from headers: ${headers.join(', ')}`)
    console.error('  Tip: use --type queries or --type pages')
    process.exit(1)
  }

  console.log(`[ingest-gsc] Detected type: ${type} (${rows.length} rows)`)

  const existing = loadExisting()

  if (type === 'queries') {
    const queries = rows.map(r => ({
      query:       r.query ?? r['top queries'] ?? '',
      clicks:      Math.round(toNum(r.clicks)),
      impressions: Math.round(toNum(r.impressions)),
      ctr:         toNum(r.ctr),
      position:    toNum(r.position),
    })).filter(q => q.query).slice(0, 100)

    // Compute totals from query data
    const totalClicks      = queries.reduce((s, q) => s + q.clicks, 0)
    const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0)
    const avgCtr           = totalImpressions > 0
      ? parseFloat((totalClicks / totalImpressions * 100).toFixed(2))
      : 0
    const avgPosition = queries.length > 0
      ? parseFloat((queries.reduce((s, q) => s + q.position, 0) / queries.length).toFixed(1))
      : 0

    existing.topQueries       = queries
    existing.totalClicks      = totalClicks
    existing.totalImpressions = totalImpressions
    existing.avgCtr           = avgCtr
    existing.avgPosition      = avgPosition

    console.log(`[ingest-gsc] Queries: ${queries.length} rows, ${totalClicks} total clicks`)
  }

  if (type === 'pages') {
    const pages = rows.map(r => ({
      page:        r.page ?? r['top pages'] ?? '',
      clicks:      Math.round(toNum(r.clicks)),
      impressions: Math.round(toNum(r.impressions)),
      ctr:         toNum(r.ctr),
      position:    toNum(r.position),
    })).filter(p => p.page).slice(0, 100)

    existing.topPages = pages
    console.log(`[ingest-gsc] Pages: ${pages.length} rows`)
  }

  existing._meta = {
    source:      'gsc-export',
    lastUpdated: new Date().toISOString(),
    csvFile:     path.basename(csvPath),
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(existing, null, 2))
  console.log(`[ingest-gsc] ✓ Wrote snapshot to ${OUT_FILE}`)
}

run()
