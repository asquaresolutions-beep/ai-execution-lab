#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// scripts/gen-embeddings-to-bigquery.mjs
// Production bulk semantic-embeddings pipeline → BigQuery (vector-ready).
//
// Features:
//  - Incremental: SHA-256 content hash per doc; UNCHANGED docs are skipped
//    (zero Vertex calls — the main cost control).
//  - Dedup-correct: changed/new ids are DELETE-then-insert (no duplicate rows).
//  - Batched Vertex :predict (BATCH instances/call) for cost efficiency.
//  - Retry with exponential backoff + jitter on 429/5xx for Vertex + BigQuery.
//  - Rich semantic metadata: source_type, title, url, word_count, lang,
//    content_hash, created_at/updated_at — ready for search/recommendations/RAG.
//
// Auth (ADC-first): runs on Cloud Run/GCE with the attached SA, or locally with
//   export VERTEX_ACCESS_TOKEN=$(gcloud auth print-access-token)
// Config: GCP_PROJECT (or metadata), BQ_DATASET=asquare_ai, VERTEX_LOCATION=us-central1
//   node scripts/gen-embeddings-to-bigquery.mjs
// ─────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto'

const LOCATION = process.env.VERTEX_LOCATION || 'us-central1'
// CANONICAL EMBEDDING CONFIG — must match lib/ai/embeddings.ts exactly so the
// stored corpus and semantic-search query vectors are VECTOR_SEARCH-compatible.
const EMBED_MODEL = process.env.VERTEX_EMBED_MODEL || 'text-multilingual-embedding-002'
const EMBED_DIM = 768 // PINNED via outputDimensionality below — never the model default.
const DATASET = process.env.BQ_DATASET || process.env.BIGQUERY_DATASET || 'asquare_ai'
const TABLE = process.env.BQ_TABLE || 'embeddings'
const BATCH = Number(process.env.EMBED_BATCH || 5)         // instances per predict call
const BQ_BASE = 'https://bigquery.googleapis.com/bigquery/v2'

// ── Auth: ADC (metadata) → explicit token ─────────────────────────
let _token, _project
async function metadata(path) {
  const host = process.env.GCE_METADATA_HOST || 'metadata.google.internal'
  const res = await fetch(`http://${host}/computeMetadata/v1/${path}`, { headers: { 'Metadata-Flavor': 'Google' } })
  if (!res.ok) throw new Error(`metadata ${path} ${res.status}`)
  return res.text()
}
async function token() {
  if (process.env.VERTEX_ACCESS_TOKEN) return process.env.VERTEX_ACCESS_TOKEN
  if (_token && _token.exp > Date.now() + 60000) return _token.value
  const j = JSON.parse(await metadata('instance/service-accounts/default/token'))
  _token = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 }
  return _token.value
}
async function project() {
  return (_project ||= process.env.GCP_PROJECT || process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || (await metadata('project/project-id')).trim())
}

// ── Retry wrapper (429/5xx) ───────────────────────────────────────
async function withRetry(fn, label, max = 3) {
  let last
  for (let i = 0; i <= max; i++) {
    try { return await fn() } catch (e) {
      last = e
      const m = /\b(429|500|502|503|504)\b/.test(String(e.message))
      if (!m || i === max) break
      const delay = Math.min(8000, 500 * 2 ** i) + Math.random() * 250
      console.warn(`  retry ${label} (${i + 1}) after ${Math.round(delay)}ms: ${e.message.slice(0, 80)}`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw last
}

async function authedFetch(url, body) {
  const t = await token()
  const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// ── Targets ───────────────────────────────────────────────────────
const WP = 'https://asquaresolution.com'
const TARGETS = [
  ...['generative-engine-optimization-geo-end-of-traditional-seo','chatgpt-search-seo-how-to-appear-in-chatgpt-answers','google-ai-overviews-impact-organic-clicks','google-ai-overviews-and-your-traffic-the-data-backed-analysis-april-2026','scamcheck-india-ai-scam-detector','trustseal-india-ai-fact-checker','operationalizing-ai-for-scale-and-sovereignty','ai-native-cloud-infrastructure-disruption-developer-empowerment','calculating-seo-roi-google-analytics','digital-marketing-in-2026'].map((s) => ({ url: `${WP}/blog/${s}/`, source_type: 'tier_a_post' })),
  ...['services/geo-seo','services/entity-seo','services/technical-seo','services/ai-automation','services/ai-consulting','digital-marketing-uk','geo-vs-seo'].map((s) => ({ url: `${WP}/${s}/`, source_type: 'service_page' })),
  { url: 'https://scamcheck.asquaresolution.com/', source_type: 'scamcheck' },
  { url: 'https://trustseal.asquaresolution.com/', source_type: 'trustseal' },
]

function extract(html) {
  const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || '').trim()
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
  const wordCount = text.split(/\s+/).length
  const lang = /[ऀ-ॿ]/.test(text) ? 'hi' : 'en'
  const contentHash = createHash('sha256').update(`${title}\n${text}`).digest('hex')
  return { title, text, wordCount, lang, contentHash }
}
const slug = (u) => u.replace(/^https?:\/\//, '').replace(/[^\w]+/g, '_').replace(/_+$/, '')

// ── BigQuery helpers ──────────────────────────────────────────────
async function ensureTable(p) {
  await authedFetch(`${BQ_BASE}/projects/${p}/datasets`, { datasetReference: { datasetId: DATASET, projectId: p }, location: process.env.BQ_LOCATION || 'US' }).catch((e) => { if (!/409/.test(e.message)) throw e })
  const schema = { fields: [
    { name: 'id', type: 'STRING', mode: 'REQUIRED' }, { name: 'source_type', type: 'STRING' }, { name: 'url', type: 'STRING' },
    { name: 'title', type: 'STRING' }, { name: 'text', type: 'STRING' }, { name: 'embedding', type: 'FLOAT64', mode: 'REPEATED' },
    { name: 'model', type: 'STRING' }, { name: 'dim', type: 'INT64' }, { name: 'content_hash', type: 'STRING' },
    { name: 'word_count', type: 'INT64' }, { name: 'lang', type: 'STRING' }, { name: 'created_at', type: 'TIMESTAMP' }, { name: 'updated_at', type: 'TIMESTAMP' },
  ] }
  await authedFetch(`${BQ_BASE}/projects/${p}/datasets/${DATASET}/tables`, { tableReference: { projectId: p, datasetId: DATASET, tableId: TABLE }, schema }).catch((e) => { if (!/409/.test(e.message)) throw e })
}

async function existingHashes(p) {
  try {
    const j = await authedFetch(`${BQ_BASE}/projects/${p}/queries`, { query: `SELECT id, content_hash FROM \`${p}.${DATASET}.${TABLE}\``, useLegacySql: false, timeoutMs: 30000 })
    const out = {}
    for (const r of j.rows ?? []) out[r.f[0].v] = r.f[1].v
    return out
  } catch (e) { console.warn('  (no existing rows / table new):', e.message.slice(0, 60)); return {} }
}

async function embedBatch(p, texts) {
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${p}/locations/${LOCATION}/publishers/google/models/${EMBED_MODEL}:predict`
  // task_type RETRIEVAL_DOCUMENT for the corpus; outputDimensionality PINNED to
  // EMBED_DIM so dimension is deterministic regardless of model default.
  const j = await withRetry(() => authedFetch(url, {
    instances: texts.map((content) => ({ content, task_type: 'RETRIEVAL_DOCUMENT' })),
    parameters: { outputDimensionality: EMBED_DIM, autoTruncate: true },
  }), 'vertex-embed')
  return (j.predictions ?? []).map((pr) => {
    const v = pr.embeddings?.values ?? []
    if (v.length && v.length !== EMBED_DIM) throw new Error(`Embedding dim ${v.length} != ${EMBED_DIM} — check VERTEX_EMBED_MODEL`)
    return v
  })
}

async function deleteIds(p, ids) {
  if (!ids.length) return
  const list = ids.map((i) => `'${i.replace(/'/g, "")}'`).join(',')
  await withRetry(() => authedFetch(`${BQ_BASE}/projects/${p}/queries`, { query: `DELETE FROM \`${p}.${DATASET}.${TABLE}\` WHERE id IN (${list})`, useLegacySql: false, timeoutMs: 60000 }), 'bq-delete')
    .catch((e) => console.warn('  delete (streaming-buffer rows may defer):', e.message.slice(0, 80)))
}

async function insertRows(p, rows) {
  if (!rows.length) return 0
  const j = await withRetry(() => authedFetch(`${BQ_BASE}/projects/${p}/datasets/${DATASET}/tables/${TABLE}/insertAll`, { rows: rows.map((r) => ({ insertId: r.id, json: r })) }), 'bq-insert')
  if (j.insertErrors?.length) console.warn(`  insert errors: ${j.insertErrors.length}`)
  return rows.length - (j.insertErrors?.length ?? 0)
}

// ── Pipeline ──────────────────────────────────────────────────────
;(async () => {
  const p = await project()
  console.log(`project=${p} dataset=${DATASET} table=${TABLE} model=${EMBED_MODEL} batch=${BATCH}`)
  await ensureTable(p)
  const known = await existingHashes(p)

  // 1. Fetch + hash; decide what needs embedding (incremental + dedup).
  const candidates = []
  for (const t of TARGETS) {
    try {
      const html = await fetch(t.url).then((r) => r.text())
      const meta = extract(html)
      if (meta.text.length < 100) { console.log(`skip (thin): ${t.url}`); continue }
      const id = slug(t.url)
      if (known[id] === meta.contentHash) { console.log(`unchanged (skip): ${id}`); continue }
      candidates.push({ id, ...t, ...meta })
    } catch (e) { console.warn(`fetch failed: ${t.url} — ${e.message.slice(0, 60)}`) }
  }
  if (!candidates.length) { console.log('\n✓ nothing changed — 0 Vertex calls. Up to date.'); return }
  console.log(`\n${candidates.length} doc(s) to (re)embed; batching ${BATCH}/call…`)

  // 2. Batched embeddings.
  const now = new Date().toISOString()
  const rows = []
  for (let i = 0; i < candidates.length; i += BATCH) {
    const chunk = candidates.slice(i, i + BATCH)
    const vecs = await embedBatch(p, chunk.map((c) => `${c.title}\n\n${c.text}`))
    chunk.forEach((c, k) => {
      const embedding = vecs[k] || []
      if (!embedding.length) { console.warn(`  empty embedding: ${c.id}`); return }
      rows.push({ id: c.id, source_type: c.source_type, url: c.url, title: c.title, text: c.text, embedding, model: EMBED_MODEL, dim: embedding.length, content_hash: c.contentHash, word_count: c.wordCount, lang: c.lang, created_at: now, updated_at: now })
      console.log(`  embedded ${c.id} (dim ${embedding.length}, ${c.lang}, ${c.wordCount}w)`)
    })
  }

  // 3. Dedup-correct upsert: delete changed ids, then insert.
  await deleteIds(p, rows.map((r) => r.id))
  const inserted = await insertRows(p, rows)
  console.log(`\n✓ upserted ${inserted}/${rows.length} rows into ${p}.${DATASET}.${TABLE}`)
  console.log('Est. cost: embeddings ~$0.000025/1k tokens → this run << ₹5. Next: create vector index, query VECTOR_SEARCH.')
})().catch((e) => { console.error('PIPELINE FAILED:', e.message); process.exit(1) })
