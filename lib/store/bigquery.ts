// ─────────────────────────────────────────────────────────────────
// lib/store/bigquery.ts
// Dependency-free BigQuery writer (REST) for the embeddings + metadata
// store. Vector-ready: the `embedding` column is ARRAY<FLOAT64>, which
// BigQuery VECTOR_SEARCH / vector indexes operate on directly.
//
// Auth: reuses the Vertex service-account access token (grant the SA
// roles/bigquery.dataEditor + roles/bigquery.jobUser). No SDK.
// ─────────────────────────────────────────────────────────────────

import { getAccessToken, serviceAccountProjectId, hasVertexAuth, adcAvailable, projectIdFromEnv, getProjectId } from '@/lib/ai/vertex-auth'
import { log } from '@/lib/observability/logger'

const PROJECT =
  process.env.BIGQUERY_PROJECT_ID ||
  process.env.VERTEX_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  serviceAccountProjectId()
const DATASET = process.env.BIGQUERY_DATASET || 'asquare_ai'
const BASE = 'https://bigquery.googleapis.com/bigquery/v2'

export interface EmbeddingRow {
  id: string
  source_type: 'tier_a_post' | 'service_page' | 'scamcheck' | 'trustseal' | 'scam_cluster' | string
  url: string
  title: string
  text: string
  embedding: number[]   // ARRAY<FLOAT64> — vector-ready
  model: string
  dim: number
  content_hash: string  // for incremental dedup (skip unchanged content)
  word_count: number    // semantic metadata
  lang: string          // 'en' | 'hi' | ...
  created_at: string    // ISO
  updated_at: string    // ISO
}

// BigQuery table schema for the embeddings store.
export const EMBEDDINGS_SCHEMA = {
  fields: [
    { name: 'id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'source_type', type: 'STRING' },
    { name: 'url', type: 'STRING' },
    { name: 'title', type: 'STRING' },
    { name: 'text', type: 'STRING' },
    { name: 'embedding', type: 'FLOAT64', mode: 'REPEATED' }, // ARRAY<FLOAT64>
    { name: 'model', type: 'STRING' },
    { name: 'dim', type: 'INT64' },
    { name: 'content_hash', type: 'STRING' },
    { name: 'word_count', type: 'INT64' },
    { name: 'lang', type: 'STRING' },
    { name: 'created_at', type: 'TIMESTAMP' },
    { name: 'updated_at', type: 'TIMESTAMP' },
  ],
}

function bqConfigured(): boolean {
  // Auth via explicit token, SA key, or Cloud Run ADC. Project resolvable
  // from env or (on GCP) the metadata server.
  return hasVertexAuth() && (!!process.env.BIGQUERY_PROJECT_ID || !!projectIdFromEnv() || adcAvailable())
}

/** Resolve the BigQuery project: explicit override → env/metadata (ADC). */
async function bqProject(): Promise<string> {
  return process.env.BIGQUERY_PROJECT_ID || (await getProjectId())
}

async function authedFetch(url: string, init: RequestInit): Promise<Response> {
  const token = await getAccessToken()
  return fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}`, 'content-type': 'application/json' } })
}

/** Create the dataset if missing (idempotent). */
export async function ensureDataset(): Promise<void> {
  if (!bqConfigured()) throw new Error('BigQuery not configured (project + Vertex/GCP credentials required)')
  const PROJECT = await bqProject()
  const res = await authedFetch(`${BASE}/projects/${PROJECT}/datasets`, {
    method: 'POST',
    body: JSON.stringify({ datasetReference: { datasetId: DATASET, projectId: PROJECT }, location: process.env.BIGQUERY_LOCATION || 'US' }),
  })
  if (!res.ok && res.status !== 409) throw new Error(`BQ ensureDataset ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/** Create the embeddings table if missing (idempotent). */
export async function ensureEmbeddingsTable(table = 'embeddings'): Promise<void> {
  const PROJECT = await bqProject()
  const res = await authedFetch(`${BASE}/projects/${PROJECT}/datasets/${DATASET}/tables`, {
    method: 'POST',
    body: JSON.stringify({ tableReference: { projectId: PROJECT, datasetId: DATASET, tableId: table }, schema: EMBEDDINGS_SCHEMA }),
  })
  if (!res.ok && res.status !== 409) throw new Error(`BQ ensureTable ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/** Stream rows via tabledata.insertAll (idempotent on insertId = row.id). */
export async function insertEmbeddingRows(rows: EmbeddingRow[], table = 'embeddings'): Promise<{ inserted: number }> {
  if (!rows.length) return { inserted: 0 }
  const PROJECT = await bqProject()
  const res = await authedFetch(`${BASE}/projects/${PROJECT}/datasets/${DATASET}/tables/${table}/insertAll`, {
    method: 'POST',
    body: JSON.stringify({ rows: rows.map((r) => ({ insertId: r.id, json: r })) }),
  })
  if (!res.ok) throw new Error(`BQ insertAll ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = (await res.json()) as { insertErrors?: unknown[] }
  if (data.insertErrors?.length) log.warn({ event: 'bq.insert_errors', count: data.insertErrors.length })
  return { inserted: rows.length - (data.insertErrors?.length ?? 0) }
}

/**
 * SQL to create a vector index for fast ANN search (run once, after load).
 * BigQuery VECTOR_SEARCH then queries nearest neighbours by COSINE distance.
 */
export function vectorIndexDDL(table = 'embeddings'): string {
  return `CREATE VECTOR INDEX IF NOT EXISTS embeddings_idx
ON \`${PROJECT}.${DATASET}.${table}\`(embedding)
OPTIONS(index_type = 'IVF', distance_type = 'COSINE');`
}

export function semanticSearchSQL(table = 'embeddings'): string {
  return `-- param: @q ARRAY<FLOAT64>
SELECT base.id, base.title, base.url, base.source_type, distance
FROM VECTOR_SEARCH(
  TABLE \`${PROJECT}.${DATASET}.${table}\`, 'embedding',
  (SELECT @q AS embedding), top_k => 8, distance_type => 'COSINE');`
}

// ── Live query (jobs.query REST) ───────────────────────────────────
export interface BQRow { [k: string]: string | null }

/** Run a synchronous BigQuery query (named params) and return mapped rows. */
export async function runQuery(sql: string, params: Array<{ name: string; type: string; value: unknown; arrayType?: string }> = []): Promise<BQRow[]> {
  if (!bqConfigured()) throw new Error('BigQuery not configured')
  const queryParameters = params.map((p) => {
    if (p.type === 'ARRAY') {
      return {
        name: p.name,
        parameterType: { type: 'ARRAY', arrayType: { type: p.arrayType || 'FLOAT64' } },
        parameterValue: { arrayValues: (p.value as number[]).map((v) => ({ value: String(v) })) },
      }
    }
    return { name: p.name, parameterType: { type: p.type }, parameterValue: { value: String(p.value) } }
  })
  const PROJECT = await bqProject()
  const res = await authedFetch(`${BASE}/projects/${PROJECT}/queries`, {
    method: 'POST',
    body: JSON.stringify({ query: sql, useLegacySql: false, parameterMode: params.length ? 'NAMED' : undefined, queryParameters, timeoutMs: 30000 }),
  })
  if (!res.ok) {
    const body = (await res.text()).slice(0, 500)
    log.error({ event: 'bq.query_error', status: res.status, body, sql: sql.slice(0, 400) })
    throw new Error(`BQ query ${res.status}: ${body}`)
  }
  const data = (await res.json()) as { schema?: { fields?: { name: string }[] }; rows?: { f: { v: string | null }[] }[] }
  const cols = data.schema?.fields?.map((f) => f.name) ?? []
  return (data.rows ?? []).map((r) => Object.fromEntries(r.f.map((cell, i) => [cols[i], cell.v])))
}

export interface VectorHit { id: string; title: string; url: string; source_type: string; distance: number; text?: string; slug?: string; category?: string }

export interface VectorSearchOptions {
  table?: string
  sourceTypes?: string[]   // restrict to these source_type values (e.g. scam corpus)
  withText?: boolean       // include a truncated body for snippets/hybrid rerank
}

// Columns we'd LIKE to project, in order. Only those present in the live
// schema are actually selected — older corpora may lack slug/category/text.
const SELECTABLE = ['id', 'title', 'url', 'source_type', 'slug', 'category'] as const

/** Live column names for a table (cached). Schema-safe SQL is built from this. */
let _tableCols: Record<string, string[]> = {}
export async function tableColumns(table = 'embeddings'): Promise<string[]> {
  if (_tableCols[table]) return _tableCols[table]
  const PROJECT = await bqProject()
  const res = await authedFetch(`${BASE}/projects/${PROJECT}/datasets/${DATASET}/tables/${table}`, { method: 'GET' })
  if (!res.ok) throw new Error(`BQ tables.get ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { schema?: { fields?: { name: string }[] } }
  const cols = (data.schema?.fields ?? []).map((f) => f.name)
  _tableCols[table] = cols
  return cols
}
export function resetSchemaCache(): void { _tableCols = {} }

interface SelectPlan { selected: string[]; missing: string[]; textIncluded: boolean; clause: string }
function selectPlan(cols: string[], withText: boolean): SelectPlan {
  const present = SELECTABLE.filter((c) => cols.includes(c))
  const missing = SELECTABLE.filter((c) => !cols.includes(c))
  const parts = present.map((c) => `base.${c} AS ${c}`)
  const textIncluded = !!withText && cols.includes('text')
  if (textIncluded) parts.push('SUBSTR(base.text, 0, 1200) AS text')
  parts.push('distance')
  return { selected: textIncluded ? [...present, 'text'] : present, missing, textIncluded, clause: parts.join(', ') }
}

/**
 * Build current-syntax, SCHEMA-SAFE VECTOR_SEARCH SQL. Only projects columns
 * that exist in `cols` (the live schema) — never hardcodes optional columns.
 * - Named args only (`top_k =>`, `distance_type =>`) — current GoogleSQL.
 * - No ROWS / LIMIT inside VECTOR_SEARCH. `ORDER BY distance ASC` = nearest first.
 */
export function buildVectorSearchSQL(project: string, k: number, cols: string[], o: VectorSearchOptions = {}): string {
  const table = o.table || 'embeddings'
  const { clause } = selectPlan(cols, !!o.withText)
  // source_type filter only when that column exists.
  const tableExpr = o.sourceTypes?.length && cols.includes('source_type')
    ? `(SELECT * FROM \`${project}.${DATASET}.${table}\` WHERE source_type IN (${o.sourceTypes.map((s) => `'${s.replace(/'/g, '')}'`).join(',')}))`
    : `TABLE \`${project}.${DATASET}.${table}\``
  return `SELECT ${clause}
FROM VECTOR_SEARCH(
  ${tableExpr}, 'embedding',
  (SELECT @q AS embedding), top_k => ${k}, distance_type => 'COSINE')
ORDER BY distance ASC`
}

export interface VectorSearchPlan { sql: string; selectedColumns: string[]; missingColumns: string[]; liveSchema: string[] }
/** Resolve the exact SQL + column plan vectorSearch() would run (for ?diag). */
export async function vectorSearchPlan(topK = 8, opts: VectorSearchOptions | string = {}): Promise<VectorSearchPlan> {
  const o: VectorSearchOptions = typeof opts === 'string' ? { table: opts } : opts
  const k = Math.max(1, Math.min(50, Math.floor(topK)))
  const PROJECT = await bqProject()
  const liveSchema = await tableColumns(o.table || 'embeddings')
  const plan = selectPlan(liveSchema, !!o.withText)
  return { sql: buildVectorSearchSQL(PROJECT, k, liveSchema, o), selectedColumns: plan.selected, missingColumns: plan.missing, liveSchema }
}

/** Live semantic search via BigQuery VECTOR_SEARCH (schema-safe). */
export async function vectorSearch(queryEmbedding: number[], topK = 8, opts: VectorSearchOptions | string = {}): Promise<VectorHit[]> {
  // Back-compat: a string 3rd arg was previously the table name.
  const o: VectorSearchOptions = typeof opts === 'string' ? { table: opts } : opts
  const k = Math.max(1, Math.min(50, Math.floor(topK)))
  const PROJECT = await bqProject()
  // Only project columns that actually exist; fall back to the required core.
  const cols = await tableColumns(o.table || 'embeddings').catch((e) => {
    log.warn({ event: 'bq.schema_fallback', detail: String(e).slice(0, 120) })
    return ['id', 'title', 'url', 'source_type', 'text']
  })
  const sql = buildVectorSearchSQL(PROJECT, k, cols, o)
  log.info({ event: 'bq.vector_search', queryDim: queryEmbedding.length, k, selected: selectPlan(cols, !!o.withText).selected, sourceTypes: o.sourceTypes ?? null })
  const rows = await runQuery(sql, [{ name: 'q', type: 'ARRAY', arrayType: 'FLOAT64', value: queryEmbedding }])
  return rows.map((r) => ({ id: r.id ?? '', title: r.title ?? '', url: r.url ?? '', source_type: r.source_type ?? '', slug: r.slug ?? undefined, category: r.category ?? undefined, distance: Number(r.distance), text: r.text ?? undefined }))
}

/** Fetch a single corpus document's display fields by id (project-safe). */
export async function getDocById(id: string, table = 'embeddings'): Promise<{ id: string; title: string; url: string; source_type: string } | null> {
  const PROJECT = await bqProject()
  const rows = await runQuery(
    `SELECT id, title, url, source_type FROM \`${PROJECT}.${DATASET}.${table}\` WHERE id = @id LIMIT 1`,
    [{ name: 'id', type: 'STRING', value: id }],
  )
  const r = rows[0]
  return r ? { id: r.id ?? '', title: r.title ?? '', url: r.url ?? '', source_type: r.source_type ?? '' } : null
}

const JUNK_RE = "checking your browser before accessing|please wait while we verify|enable javascript and cookies|just a moment|attention required|cf-browser-verification|challenge-platform|performance (and|&) security by cloudflare|access denied|ddos protection"

export interface CorpusHealth {
  total: number
  avgWordCount: number
  avgUniqueRatio: number
  junkRows: number
  healthScore: number          // 0..100
  suspiciousRows: Array<{ id: string; title: string }>
}

/**
 * Corpus quality health check (task 8): avg word count, avg unique-token ratio
 * (over a sample), count of rows that still look like anti-bot/junk pages, and
 * a 0..100 health score. Read-only; used by ?diag=1.
 */
export async function corpusHealth(table = 'embeddings'): Promise<CorpusHealth> {
  const PROJECT = await bqProject()
  const cols = await tableColumns(table).catch(() => [] as string[])
  const hasText = cols.includes('text')
  const hasWords = cols.includes('word_count')
  const titleBody = `LOWER(CONCAT(IFNULL(title,''),' ',${hasText ? "IFNULL(SUBSTR(text,0,500),'')" : "''"}))`
  const agg = await runQuery(
    `SELECT COUNT(*) AS total, ${hasWords ? 'AVG(word_count)' : '0'} AS avg_words, COUNTIF(REGEXP_CONTAINS(${titleBody}, r'${JUNK_RE}')) AS junk FROM \`${PROJECT}.${DATASET}.${table}\``,
  )
  const total = Number(agg[0]?.total ?? 0)
  const avgWordCount = Math.round(Number(agg[0]?.avg_words ?? 0))
  const junkRows = Number(agg[0]?.junk ?? 0)

  // Unique-token ratio over a bounded sample (text column only).
  let avgUniqueRatio = 0
  if (hasText && total) {
    const sample = await runQuery(`SELECT SUBSTR(text, 0, 1500) AS t FROM \`${PROJECT}.${DATASET}.${table}\` LIMIT 25`).catch(() => [])
    const ratios = sample.map((r) => { const toks = (r.t ?? '').toLowerCase().match(/[a-z0-9ऀ-ॿ]+/g) ?? []; return toks.length ? new Set(toks).size / toks.length : 0 })
    if (ratios.length) avgUniqueRatio = Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 1000) / 1000
  }

  const suspiciousRows = total
    ? (await runQuery(`SELECT id, title FROM \`${PROJECT}.${DATASET}.${table}\` WHERE REGEXP_CONTAINS(${titleBody}, r'${JUNK_RE}') LIMIT 10`).catch(() => []))
        .map((r) => ({ id: r.id ?? '', title: r.title ?? '' }))
    : []

  // Health = clean-fraction × content-depth factor.
  const healthScore = total ? Math.max(0, Math.round(100 * (1 - junkRows / total) * Math.min(1, (avgWordCount || 1) / 120))) : 0
  return { total, avgWordCount, avgUniqueRatio, junkRows, healthScore, suspiciousRows }
}

export interface CorpusDim { dim: number; recorded_dim: number; model: string; rows: number }

/**
 * Inspect the ACTUAL stored embedding dimensions in the corpus (the real
 * source of truth — never assumed). Groups by the on-disk vector length so a
 * mixed/legacy corpus is visible. Used to diagnose VECTOR_SEARCH dimension
 * mismatches instead of guessing.
 */
export async function corpusDimensions(table = 'embeddings'): Promise<CorpusDim[]> {
  const PROJECT = await bqProject()
  // `rows` is a RESERVED keyword in GoogleSQL — alias the count as `n`.
  // Use a subquery so we don't reference a SELECT alias within the same list.
  const sql = `SELECT actual_dim, ANY_VALUE(stored_dim) AS recorded_dim, ANY_VALUE(model) AS model, COUNT(*) AS n
FROM (SELECT ARRAY_LENGTH(embedding) AS actual_dim, dim AS stored_dim, model FROM \`${PROJECT}.${DATASET}.${table}\`)
GROUP BY actual_dim
ORDER BY n DESC`
  const rows = await runQuery(sql)
  return rows.map((r) => ({ dim: Number(r.actual_dim), recorded_dim: Number(r.recorded_dim), model: r.model ?? '', rows: Number(r.n) }))
}

// ── Image-analysis telemetry (task 8) ──────────────────────────────
export interface ImageAnalysisRow {
  id: string                 // image content hash (dedups duplicate uploads)
  verdict: string
  risk_score: number
  scam_probability: number
  trust_score: number
  category: string
  ocr_chars: number
  ocr_engine: string
  lang: string
  phones: number
  urls: number
  shorteners: number
  upi_ids: number
  signals: number
  deep_used: boolean
  created_at: string
}

const IMAGE_TABLE = process.env.BQ_IMAGE_TABLE || 'scam_image_analysis'
let _imageTableReady = false

async function ensureImageTable(PROJECT: string): Promise<void> {
  if (_imageTableReady) return
  const schema = { fields: [
    { name: 'id', type: 'STRING', mode: 'REQUIRED' }, { name: 'verdict', type: 'STRING' },
    { name: 'risk_score', type: 'INT64' }, { name: 'scam_probability', type: 'FLOAT64' }, { name: 'trust_score', type: 'INT64' },
    { name: 'category', type: 'STRING' }, { name: 'ocr_chars', type: 'INT64' }, { name: 'ocr_engine', type: 'STRING' }, { name: 'lang', type: 'STRING' },
    { name: 'phones', type: 'INT64' }, { name: 'urls', type: 'INT64' }, { name: 'shorteners', type: 'INT64' }, { name: 'upi_ids', type: 'INT64' },
    { name: 'signals', type: 'INT64' }, { name: 'deep_used', type: 'BOOL' }, { name: 'created_at', type: 'TIMESTAMP' },
  ] }
  const res = await authedFetch(`${BASE}/projects/${PROJECT}/datasets/${DATASET}/tables`, {
    method: 'POST', body: JSON.stringify({ tableReference: { projectId: PROJECT, datasetId: DATASET, tableId: IMAGE_TABLE }, schema }),
  })
  if (!res.ok && res.status !== 409) throw new Error(`ensureImageTable ${res.status}`)
  _imageTableReady = true
}

/** Best-effort: store one image-analysis telemetry row (never throws). */
export async function logImageAnalysis(row: ImageAnalysisRow): Promise<void> {
  try {
    if (!bqConfigured()) return
    const PROJECT = await bqProject()
    await ensureDataset().catch(() => {})
    await ensureImageTable(PROJECT)
    const res = await authedFetch(`${BASE}/projects/${PROJECT}/datasets/${DATASET}/tables/${IMAGE_TABLE}/insertAll`, {
      method: 'POST', body: JSON.stringify({ rows: [{ insertId: row.id, json: row }] }),
    })
    if (!res.ok) log.warn({ event: 'bq.image_telemetry_failed', status: res.status })
  } catch (e) {
    log.warn({ event: 'bq.image_telemetry_error', detail: String(e).slice(0, 120) })
  }
}

export function bigQueryReady(): boolean { return bqConfigured() }

export { PROJECT as BIGQUERY_PROJECT, DATASET as BIGQUERY_DATASET }
