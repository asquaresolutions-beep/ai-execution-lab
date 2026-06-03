#!/usr/bin/env node
/**
 * scripts/ingest-vercel.mjs
 * Phase 2 — Vercel Deployment Telemetry Ingestion
 *
 * Fetches recent deployments from the Vercel API and writes a snapshot
 * to data/telemetry/deployments.json.
 *
 * Usage:
 *   node scripts/ingest-vercel.mjs
 *
 * Required environment variables (set in .env.local or shell):
 *   VERCEL_TOKEN       — Vercel API token (Account Settings → Tokens)
 *   VERCEL_PROJECT_ID  — Project ID (Vercel project → Settings → General)
 *   VERCEL_TEAM_ID     — Team ID (optional, for team accounts)
 *
 * Output: data/telemetry/deployments.json
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_FILE  = path.join(ROOT, 'data', 'telemetry', 'deployments.json')

// ── Load env from .env.local if present ─────────────────────────────────────

function loadEnv() {
  const envFile = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envFile)) return
  const lines = fs.readFileSync(envFile, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

// ── Config ───────────────────────────────────────────────────────────────────

const TOKEN      = process.env.VERCEL_TOKEN
const PROJECT_ID = process.env.VERCEL_PROJECT_ID
const TEAM_ID    = process.env.VERCEL_TEAM_ID   // optional

if (!TOKEN || !PROJECT_ID) {
  console.error('[ingest-vercel] ERROR: VERCEL_TOKEN and VERCEL_PROJECT_ID are required.')
  console.error('  Set them in .env.local or as shell environment variables.')
  process.exit(1)
}

const BASE = 'https://api.vercel.com'
const HEADERS = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type':  'application/json',
}

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchDeployments() {
  const teamQuery = TEAM_ID ? `&teamId=${TEAM_ID}` : ''
  const url = `${BASE}/v6/deployments?projectId=${PROJECT_ID}&limit=20&target=production${teamQuery}`

  console.log('[ingest-vercel] Fetching deployments...')
  const res = await fetch(url, { headers: HEADERS })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Vercel API ${res.status}: ${body}`)
  }

  const data = await res.json()
  return data.deployments ?? []
}

// ── Transform ────────────────────────────────────────────────────────────────

function transform(raw) {
  return raw.map(d => {
    const buildStart     = d.buildingAt ?? null
    const buildComplete  = d.ready      ?? null
    const buildDuration  = (buildStart && buildComplete)
      ? Math.round((buildComplete - buildStart) / 1000)
      : null

    return {
      uid:           d.uid,
      url:           d.url ? `https://${d.url}` : '',
      state:         d.readyState ?? 'unknown',
      createdAt:     new Date(d.createdAt).toISOString(),
      buildDuration,
      branch:        d.meta?.githubCommitRef ?? 'main',
      commitMessage: d.meta?.githubCommitMessage ?? '',
      commitSha:     (d.meta?.githubCommitSha ?? '').slice(0, 7),
      meta: {
        buildStarted:   buildStart   ? new Date(buildStart).toISOString()   : null,
        buildCompleted: buildComplete ? new Date(buildComplete).toISOString() : null,
      },
    }
  })
}

// ── Write ────────────────────────────────────────────────────────────────────

async function run() {
  try {
    const raw          = await fetchDeployments()
    const deployments  = transform(raw)

    const snapshot = {
      _meta: {
        source:      'vercel-api',
        lastUpdated: new Date().toISOString(),
        projectId:   PROJECT_ID,
        count:       deployments.length,
      },
      deployments,
    }

    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
    fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2))

    console.log(`[ingest-vercel] ✓ Wrote ${deployments.length} deployments to ${OUT_FILE}`)

    if (deployments.length > 0) {
      const latest = deployments[0]
      console.log(`  Latest: ${latest.state} — ${latest.commitMessage} (${latest.commitSha})`)
      if (latest.buildDuration) {
        console.log(`  Build duration: ${latest.buildDuration}s`)
      }
    }
  } catch (err) {
    console.error('[ingest-vercel] FAILED:', err.message)
    process.exit(1)
  }
}

run()
