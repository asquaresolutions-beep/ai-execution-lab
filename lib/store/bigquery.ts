// ─────────────────────────────────────────────────────────────────
// lib/store/bigquery.ts
// Dependency-free BigQuery writer (REST) for the embeddings + metadata
// store. Vector-ready: the `embedding` column is ARRAY<FLOAT64>, which
// BigQuery VECTOR_SEARCH / vector indexes operate on directly.
//
// Auth: reuses the Vertex service-account access token (grant the SA
// roles/bigquery.dataEditor + roles/bigquery.jobUser). No SDK.
// ─────────────────────────────────────────────────────────────────

import { getAccessToken, serviceAccountProjectId } from '@/lib/ai/vertex-auth'
import { log } from '@/lib/observability/logger'

const PROJECT =
  process.env.BIGQUERY_PROJECT_ID ||
  process.env.VERTEX_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
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
  created_at: string    // ISO
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
    { name: 'created_at', type: 'TIMESTAMP' },
  ],
}

function bqConfigured(): boolean {
  return !!PROJECT && (!!process.env.VERTEX_ACCESS_TOKEN || !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !!process.env.GCP_SERVICE_ACCOUNT_KEY)
}

async function authedFetch(url: string, init: RequestInit): Promise<Response> {
  const token = await getAccessToken()
  return fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}`, 'content-type': 'application/json' } })
}

/** Create the dataset if missing (idempotent). */
export async function ensureDataset(): Promise<void> {
  if (!bqConfigured()) throw new Error('BigQuery not configured (project + Vertex/GCP credentials required)')
  const res = await authedFetch(`${BASE}/projects/${PROJECT}/datasets`, {
    method: 'POST',
    body: JSON.stringify({ datasetReference: { datasetId: DATASET, projectId: PROJECT }, location: process.env.BIGQUERY_LOCATION || 'US' }),
  })
  if (!res.ok && res.status !== 409) throw new Error(`BQ ensureDataset ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/** Create the embeddings table if missing (idempotent). */
export async function ensureEmbeddingsTable(table = 'embeddings'): Promise<void> {
  const res = await authedFetch(`${BASE}/projects/${PROJECT}/datasets/${DATASET}/tables`, {
    method: 'POST',
    body: JSON.stringify({ tableReference: { projectId: PROJECT, datasetId: DATASET, tableId: table }, schema: EMBEDDINGS_SCHEMA }),
  })
  if (!res.ok && res.status !== 409) throw new Error(`BQ ensureTable ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/** Stream rows via tabledata.insertAll (idempotent on insertId = row.id). */
export async function insertEmbeddingRows(rows: EmbeddingRow[], table = 'embeddings'): Promise<{ inserted: number }> {
  if (!rows.length) return { inserted: 0 }
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
  return `-- params: @query_embedding ARRAY<FLOAT64>, @top_k INT64
SELECT base.id, base.title, base.url, base.source_type, distance
FROM VECTOR_SEARCH(
  TABLE \`${PROJECT}.${DATASET}.${table}\`, 'embedding',
  (SELECT @query_embedding AS embedding), top_k => @top_k, distance_type => 'COSINE');`
}

export { PROJECT as BIGQUERY_PROJECT, DATASET as BIGQUERY_DATASET }
