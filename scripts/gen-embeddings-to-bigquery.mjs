#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// scripts/gen-embeddings-to-bigquery.mjs
// Generate Vertex AI embeddings for Tier-A posts, service pages, and the
// ScamCheck/TrustSeal content, and load them into BigQuery (vector-ready).
//
// Self-contained (REST only). Auth via a bearer token:
//   export VERTEX_ACCESS_TOKEN=$(gcloud auth print-access-token)
//   export GCP_PROJECT=your-project   BQ_DATASET=asquare_ai   VERTEX_LOCATION=us-central1
//   node scripts/gen-embeddings-to-bigquery.mjs
//
// Cost: ~tiny. Embeddings are ~$0.025/1M tokens; this corpus is a few
// hundred KB → well under ₹5. (The "credit consumption" comes mainly from
// Cloud Run + Vertex generation inference, not embeddings.)
// ─────────────────────────────────────────────────────────────────

const TOKEN = process.env.VERTEX_ACCESS_TOKEN
const PROJECT = process.env.GCP_PROJECT || process.env.VERTEX_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1'
const EMBED_MODEL = process.env.VERTEX_EMBED_MODEL || 'text-multilingual-embedding-002'
const DATASET = process.env.BQ_DATASET || 'asquare_ai'
const TABLE = process.env.BQ_TABLE || 'embeddings'

if (!TOKEN || !PROJECT) {
  console.error('Set VERTEX_ACCESS_TOKEN (gcloud auth print-access-token) and GCP_PROJECT.')
  process.exit(1)
}

const WP = 'https://asquaresolution.com'
const TARGETS = [
  // Tier-A posts
  ...['generative-engine-optimization-geo-end-of-traditional-seo','chatgpt-search-seo-how-to-appear-in-chatgpt-answers','google-ai-overviews-impact-organic-clicks','google-ai-overviews-and-your-traffic-the-data-backed-analysis-april-2026','scamcheck-india-ai-scam-detector','trustseal-india-ai-fact-checker','operationalizing-ai-for-scale-and-sovereignty','ai-native-cloud-infrastructure-disruption-developer-empowerment','calculating-seo-roi-google-analytics','digital-marketing-in-2026'].map((s) => ({ url: `${WP}/blog/${s}/`, source_type: 'tier_a_post' })),
  // Service pages
  ...['services/geo-seo','services/entity-seo','services/technical-seo','services/ai-automation','services/ai-consulting','digital-marketing-uk','geo-vs-seo'].map((s) => ({ url: `${WP}/${s}/`, source_type: 'service_page' })),
  // Products
  { url: 'https://scamcheck.asquaresolution.com/', source_type: 'scamcheck' },
  { url: 'https://trustseal.asquaresolution.com/', source_type: 'trustseal' },
]

function stripHtml(html) {
  const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || '').trim()
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return { title, text: body.slice(0, 6000) }
}

async function embed(text) {
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${EMBED_MODEL}:predict`
  const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ instances: [{ content: text, task_type: 'RETRIEVAL_DOCUMENT' }] }) })
  if (!res.ok) throw new Error(`embed ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = await res.json()
  return j.predictions?.[0]?.embeddings?.values || []
}

async function ensureDatasetAndTable() {
  const base = 'https://bigquery.googleapis.com/bigquery/v2'
  const h = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }
  let r = await fetch(`${base}/projects/${PROJECT}/datasets`, { method: 'POST', headers: h, body: JSON.stringify({ datasetReference: { datasetId: DATASET, projectId: PROJECT }, location: process.env.BQ_LOCATION || 'US' }) })
  if (!r.ok && r.status !== 409) throw new Error(`dataset ${r.status}: ${await r.text()}`)
  r = await fetch(`${base}/projects/${PROJECT}/datasets/${DATASET}/tables`, { method: 'POST', headers: h, body: JSON.stringify({ tableReference: { projectId: PROJECT, datasetId: DATASET, tableId: TABLE }, schema: { fields: [
    { name: 'id', type: 'STRING', mode: 'REQUIRED' }, { name: 'source_type', type: 'STRING' }, { name: 'url', type: 'STRING' },
    { name: 'title', type: 'STRING' }, { name: 'text', type: 'STRING' }, { name: 'embedding', type: 'FLOAT64', mode: 'REPEATED' },
    { name: 'model', type: 'STRING' }, { name: 'dim', type: 'INT64' }, { name: 'created_at', type: 'TIMESTAMP' },
  ] } }) })
  if (!r.ok && r.status !== 409) throw new Error(`table ${r.status}: ${await r.text()}`)
}

async function insertRows(rows) {
  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT}/datasets/${DATASET}/tables/${TABLE}/insertAll`
  const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ rows: rows.map((r) => ({ insertId: r.id, json: r })) }) })
  if (!res.ok) throw new Error(`insertAll ${res.status}: ${await res.text()}`)
  return res.json()
}

const slug = (u) => u.replace(/^https?:\/\//, '').replace(/[^\w]+/g, '_').replace(/_+$/,'')

;(async () => {
  await ensureDatasetAndTable()
  const rows = []
  for (const t of TARGETS) {
    try {
      const html = await fetch(t.url).then((r) => r.text())
      const { title, text } = stripHtml(html)
      if (text.length < 100) { console.warn('skip (thin):', t.url); continue }
      const vec = await embed(`${title}\n\n${text}`)
      rows.push({ id: slug(t.url), source_type: t.source_type, url: t.url, title, text, embedding: vec, model: EMBED_MODEL, dim: vec.length, created_at: new Date().toISOString() })
      console.log(`embedded ${t.url} (dim ${vec.length})`)
    } catch (e) { console.warn('failed:', t.url, e.message) }
  }
  const res = await insertRows(rows)
  console.log(`\n✓ inserted ${rows.length} rows into ${PROJECT}.${DATASET}.${TABLE}`, res.insertErrors ? `(errors: ${res.insertErrors.length})` : '')
  console.log('Next: create the vector index, then VECTOR_SEARCH. See content/docs/gcp-ai-infrastructure.mdx')
})()
