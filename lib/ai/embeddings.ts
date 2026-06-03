// ─────────────────────────────────────────────────────────────────
// lib/ai/embeddings.ts
// Text embeddings + vector math via Vertex AI (no SDK).
//
// - Uses the Vertex `:predict` endpoint with a MULTILINGUAL embedding
//   model (good for English + Hindi). Falls back to a deterministic
//   hash pseudo-embedding when Vertex is not configured, so dedup /
//   clustering / search stay testable offline.
// - Real batching: embedBatch() packs many texts into ONE predict call
//   (chunked), cutting request count and cost.
// ─────────────────────────────────────────────────────────────────

import { getAccessToken, getProjectId } from './vertex-auth'
import { vertexConfigured } from './provider'
import { recordUsage } from './usage'
import { log } from '@/lib/observability/logger'

// Last live-embedding failure reason (status + body snippet). Surfaced by the
// semantic-search route so operators can see EXACTLY why a query fell back to
// the non-semantic vector, without digging through Cloud Run logs.
let lastEmbedError: string | null = null
export function getLastEmbedError(): string | null { return lastEmbedError }

// ── CANONICAL EMBEDDING CONFIG (single source of truth) ────────────
// One model + one dimensionality across the whole platform so the stored
// corpus and query vectors are always VECTOR_SEARCH-compatible.
// `scripts/gen-embeddings-to-bigquery.mjs` MUST mirror these exact values.
//   model: text-multilingual-embedding-002 (EN + HI)
//   dim:   768 — PINNED via outputDimensionality, never the model default,
//          so a divergent VERTEX_EMBED_MODEL can't change the dimension.
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1'
export const EMBED_MODEL = process.env.VERTEX_EMBED_MODEL || 'text-multilingual-embedding-002'
export const EMBED_DIM = 768
const BATCH_SIZE = 25 // Vertex allows up to 250 instances; keep payloads modest.

// Asymmetric retrieval: docs and queries share MODEL+DIM but use different
// task types for best relevance.
export type EmbedTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

export interface EmbeddingResult {
  vector: number[]
  model: string
  live: boolean
}

function base(): string {
  return LOCATION === 'global'
    ? 'https://aiplatform.googleapis.com'
    : `https://${LOCATION}-aiplatform.googleapis.com`
}

/** Embed a single DOCUMENT (ingestion side). */
export async function embed(text: string): Promise<EmbeddingResult> {
  const [res] = await embedBatch([text], 'RETRIEVAL_DOCUMENT')
  return res
}

/**
 * Embed a single QUERY (search side). Same model + dimension as documents,
 * but task_type=RETRIEVAL_QUERY for correct asymmetric retrieval. This is the
 * function the semantic-search endpoint MUST use so query vectors match the
 * stored 768-dim corpus exactly.
 */
export async function embedQuery(text: string): Promise<EmbeddingResult> {
  const [res] = await embedBatch([text], 'RETRIEVAL_QUERY')
  return res
}

/** Batched embeddings — one Vertex predict call per BATCH_SIZE chunk. */
export async function embedBatch(texts: string[], taskType: EmbedTaskType = 'RETRIEVAL_DOCUMENT'): Promise<EmbeddingResult[]> {
  const inputs = texts.map((t) => (t || '').slice(0, 8000))
  if (!vertexConfigured()) {
    return inputs.map((t) => ({ vector: hashEmbedding(t), model: 'mock-hash', live: false }))
  }

  const out: EmbeddingResult[] = []
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const chunk = inputs.slice(i, i + BATCH_SIZE)
    try {
      const res = await predictChunk(chunk, taskType)
      out.push(...res)
      lastEmbedError = null // clear on success
    } catch (e) {
      // Degrade gracefully — never break ingestion on an embedding hiccup —
      // but RECORD why so it can be surfaced/diagnosed instead of silently lost.
      lastEmbedError = e instanceof Error ? e.message : String(e)
      log.warn({ event: 'embeddings.fallback', model: EMBED_MODEL, taskType, reason: lastEmbedError })
      out.push(...chunk.map((t) => ({ vector: hashEmbedding(t), model: 'mock-hash-fallback', live: false })))
    }
  }
  return out
}

/** POST to the Vertex :predict endpoint; throws a rich error on non-2xx. */
async function callPredict(url: string, token: string, body: unknown): Promise<VertexEmbedResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)
    throw new Error(`Vertex embed ${res.status}: ${detail}`)
  }
  return (await res.json()) as VertexEmbedResponse
}

async function predictChunk(chunk: string[], taskType: EmbedTaskType): Promise<EmbeddingResult[]> {
  const project = await getProjectId()
  if (!project) throw new Error('Vertex project not resolvable (ADC/metadata + VERTEX_PROJECT_ID)')
  const token = await getAccessToken()
  const url = `${base()}/v1/projects/${project}/locations/${LOCATION}/publishers/google/models/${EMBED_MODEL}:predict`
  const instances = chunk.map((content) => ({ content, task_type: taskType }))

  // Attempt 1: with pinned dimensionality. Attempt 2 (only on a 4xx that
  // suggests an unsupported parameter): retry WITHOUT `parameters`. The
  // canonical model's native output is already 768, so dropping the param
  // keeps query vectors corpus-compatible while self-healing a request-format
  // rejection. Auth/permission/404 errors are NOT masked — they re-throw.
  let data: VertexEmbedResponse
  try {
    data = await callPredict(url, token, { instances, parameters: { outputDimensionality: EMBED_DIM, autoTruncate: true } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/\b400\b/.test(msg)) {
      log.warn({ event: 'embeddings.retry_no_params', reason: msg.slice(0, 160) })
      data = await callPredict(url, token, { instances })
    } else {
      throw e
    }
  }
  const preds = data.predictions ?? []
  let tokenCount = 0
  const results = chunk.map((_, idx) => {
    const values = preds[idx]?.embeddings?.values ?? []
    tokenCount += preds[idx]?.embeddings?.statistics?.token_count ?? 0
    // Hard guard: a live vector MUST be exactly EMBED_DIM. If a misconfigured
    // model returns a different size, fail loudly rather than poison the store
    // or trigger a VECTOR_SEARCH dimension-mismatch at query time.
    if (values.length && values.length !== EMBED_DIM) {
      throw new Error(`Embedding dim ${values.length} != canonical ${EMBED_DIM} (model ${EMBED_MODEL}). Check VERTEX_EMBED_MODEL.`)
    }
    return values.length
      ? { vector: values, model: EMBED_MODEL, live: true }
      : { vector: hashEmbedding(chunk[idx]), model: 'mock-hash-fallback', live: false }
  })
  if (tokenCount > 0) {
    await recordUsage(EMBED_MODEL, 'embedding', { promptTokens: tokenCount, outputTokens: 0, totalTokens: tokenCount })
  }
  return results
}

interface VertexEmbedResponse {
  predictions?: Array<{ embeddings?: { values?: number[]; statistics?: { token_count?: number } } }>
}

// ── Vector math ────────────────────────────────────────────────────
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export function rankBySimilarity<T extends { vector: number[] }>(
  query: number[], candidates: T[], topK = 10,
): Array<T & { score: number }> {
  return candidates
    .map((c) => ({ ...c, score: cosineSimilarity(query, c.vector) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, topK)
}

// ── Deterministic fallback embedding ───────────────────────────────
function hashEmbedding(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0)
  const tokens = text.toLowerCase().match(/[a-z0-9ऀ-ॿ]+/g) ?? [] // includes Devanagari
  for (const tok of tokens) vec[fnv1a(tok) % EMBED_DIM] += 1
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}
