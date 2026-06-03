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
  if (!res.ok) throw new Error(`BQ query ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = (await res.json()) as { schema?: { fields?: { name: string }[] }; rows?: { f: { v: string | null }[] }[] }
  const cols = data.schema?.fields?.map((f) => f.name) ?? []
  return (data.rows ?? []).map((r) => Object.fromEntries(r.f.map((cell, i) => [cols[i], cell.v])))
}

export interface VectorHit { id: string; title: string; url: string; source_type: string; distance: number }

/** Live semantic search via BigQuery VECTOR_SEARCH (brute-force or index-backed). */
export async function vectorSearch(queryEmbedding: number[], topK = 8, table = 'embeddings'): Promise<VectorHit[]> {
  const k = Math.max(1, Math.min(50, Math.floor(topK)))
  const PROJECT = await bqProject()
  const sql = `SELECT base.id AS id, base.title AS title, base.url AS url, base.source_type AS source_type, distance
FROM VECTOR_SEARCH(
  TABLE \`${PROJECT}.${DATASET}.${table}\`, 'embedding',
  (SELECT @q AS embedding), top_k => ${k}, distance_type => 'COSINE')
ORDER BY distance`
  const rows = await runQuery(sql, [{ name: 'q', type: 'ARRAY', arrayType: 'FLOAT64', value: queryEmbedding }])
  return rows.map((r) => ({ id: r.id ?? '', title: r.title ?? '', url: r.url ?? '', source_type: r.source_type ?? '', distance: Number(r.distance) }))
}

export function bigQueryReady(): boolean { return bqConfigured() }

export { PROJECT as BIGQUERY_PROJECT, DATASET as BIGQUERY_DATASET }
