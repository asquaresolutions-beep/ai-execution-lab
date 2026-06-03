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

// ── Content sources (structured-first; never scrape rendered HTML) ─
// Priority: WordPress REST API (clean JSON: body, slug, categories, dates)
// → quality-gated direct fetch for non-WP apps (our own subdomains). The old
// approach scraped rendered pages and captured Cloudflare "Just a moment…"
// interstitials. Structured JSON endpoints bypass the bot-challenge entirely.
const WP = process.env.WP_BASE || 'https://asquaresolution.com'
const SUBDOMAINS = [
  { url: 'https://scamcheck.asquaresolution.com/', source_type: 'scamcheck' },
  { url: 'https://trustseal.asquaresolution.com/', source_type: 'trustseal' },
]
// Strategic posts that should be tagged tier_a (higher retrieval weight signal).
const TIER_A_SLUGS = new Set(['generative-engine-optimization-geo-end-of-traditional-seo','chatgpt-search-seo-how-to-appear-in-chatgpt-answers','google-ai-overviews-impact-organic-clicks','google-ai-overviews-and-your-traffic-the-data-backed-analysis-april-2026','scamcheck-india-ai-scam-detector','trustseal-india-ai-fact-checker','operationalizing-ai-for-scale-and-sovereignty','ai-native-cloud-infrastructure-disruption-developer-empowerment','calculating-seo-roi-google-analytics','digital-marketing-in-2026'])

const slug = (u) => u.replace(/^https?:\/\//, '').replace(/[^\w]+/g, '_').replace(/_+$/, '')

// ── Content sanitization ───────────────────────────────────────────
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#x27;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}
function stripHtml(html, { dropChrome = false } = {}) {
  let h = html
  h = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
  if (dropChrome) {
    // Remove site chrome + cookie/consent boilerplate for raw HTML pages.
    h = h.replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, ' ')
         .replace(/<div[^>]*(cookie|consent|gdpr|banner|subscribe|newsletter)[^>]*>[\s\S]*?<\/div>/gi, ' ')
  }
  return decodeEntities(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

// ── Content-quality validation (task 9) ────────────────────────────
const JUNK_TITLE = /just a moment|checking your browser|attention required|enable javascript and cookies|cloudflare|access denied|are you human|verify you are human|403 forbidden/i
const JUNK_BODY = /cf-browser-verification|cf_chl|challenge-platform|enable javascript and cookies to continue|performance & security by cloudflare/i
function validate({ title, text }) {
  if (!title || JUNK_TITLE.test(title)) return 'cloudflare/junk title'
  if (JUNK_BODY.test(text)) return 'cloudflare challenge body'
  const words = text.split(/\s+/).filter(Boolean).length
  if (words < 80) return `too thin (${words} words)`
  // Reject pages dominated by boilerplate (low unique-word ratio).
  const uniq = new Set(text.toLowerCase().split(/\s+/)).size
  if (uniq / words < 0.18) return `low lexical diversity (${uniq}/${words})`
  return null // OK
}

function metaOf(text) {
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const lang = /[ऀ-ॿ]/.test(text) ? 'hi' : 'en'
  return { wordCount, lang }
}
function buildDoc({ url, source_type, title, body, excerpt = '', slugVal = '', category = '', publishedAt = '', updatedAt = '' }) {
  const text = `${title}\n\n${excerpt ? excerpt + '\n\n' : ''}${body}`.replace(/\s+/g, ' ').trim().slice(0, 8000)
  const { wordCount, lang } = metaOf(text)
  const contentHash = createHash('sha256').update(`${title}\n${text}`).digest('hex')
  // Keep the full body for chunking; `text` stays the canonical doc-level field.
  return { id: slug(url), url, source_type, title, text, body, excerpt, slug: slugVal || slug(url), category, published_at: publishedAt || null, updated_at: updatedAt || null, wordCount, lang, contentHash }
}

// ── Intelligent chunking (task 1) ──────────────────────────────────
// Long articles lose local detail in one 768-dim vector. Split on paragraph
// boundaries into ~380-token chunks with sentence overlap; embed each as its
// own row (id `${docId}__c${i}`, parent_id + chunk_index) for precise
// retrieval. Short docs stay a single chunk. Bounded to MAX_CHUNKS for cost.
const estTokens = (t) => Math.ceil(t.split(/\s+/).filter(Boolean).length * 1.3)
const MAX_SINGLE_TOKENS = Number(process.env.CHUNK_SINGLE_MAX || 420)
const CHUNK_TOKENS = Number(process.env.CHUNK_TOKENS || 380)
const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP || 60)
const MAX_CHUNKS = Number(process.env.MAX_CHUNKS || 12)

function chunkBody(title, body) {
  const paras = body.split(/(?<=[.!?])\s+(?=[A-Z0-9])|\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const chunks = []
  let buf = [], bufTok = 0
  const flush = () => {
    if (!buf.length) return
    chunks.push(`${title}\n\n${buf.join(' ')}`)
    if (CHUNK_OVERLAP > 0) {
      const carry = []; let ct = 0
      for (let i = buf.length - 1; i >= 0 && ct < CHUNK_OVERLAP; i--) { carry.unshift(buf[i]); ct += estTokens(buf[i]) }
      buf = carry; bufTok = ct
    } else { buf = []; bufTok = 0 }
  }
  for (const para of paras) {
    const t = estTokens(para)
    if (bufTok + t > CHUNK_TOKENS && bufTok > 0) flush()
    buf.push(para); bufTok += t
    if (chunks.length >= MAX_CHUNKS) break
  }
  flush()
  return chunks.slice(0, MAX_CHUNKS)
}

/** Expand a doc into 1+ chunk-rows (parent_id, chunk_index, per-chunk hash). */
function expandToChunks(doc) {
  const full = doc.text
  if (estTokens(full) <= MAX_SINGLE_TOKENS) {
    return [{ ...doc, parent_id: doc.id, chunk_index: 0, chunk_total: 1 }]
  }
  const parts = chunkBody(doc.title, doc.body || full)
  return parts.map((text, i) => {
    const { wordCount, lang } = metaOf(text)
    return {
      ...doc,
      id: `${doc.id}__c${i}`,
      parent_id: doc.id,
      chunk_index: i,
      chunk_total: parts.length,
      text: text.slice(0, 8000),
      wordCount, lang,
      contentHash: createHash('sha256').update(`${doc.id}#${i}\n${text}`).digest('hex'),
    }
  })
}

// ── Source: WordPress REST API (clean structured content) ──────────
async function fetchWpKind(kind) {
  const docs = []
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${WP}/wp-json/wp/v2/${kind}?per_page=100&page=${page}&_embed=1&orderby=modified&order=desc`, { headers: { accept: 'application/json' } })
    if (res.status === 400) break // past last page
    if (!res.ok) { console.warn(`  WP ${kind} page ${page}: HTTP ${res.status}`); break }
    const items = await res.json()
    if (!Array.isArray(items) || !items.length) break
    for (const it of items) {
      const title = decodeEntities(stripHtml(it.title?.rendered || ''))
      const body = stripHtml(it.content?.rendered || '')
      const excerpt = stripHtml(it.excerpt?.rendered || '')
      const link = it.link || `${WP}/${it.slug}/`
      const category = (it._embedded?.['wp:term']?.[0]?.[0]?.name) || ''
      const isService = /\/services?\//.test(link) || /service/i.test(category)
      const source_type = kind === 'pages' ? (isService ? 'service_page' : 'page') : (TIER_A_SLUGS.has(it.slug) ? 'tier_a_post' : 'blog_post')
      docs.push(buildDoc({
        url: link, source_type, title, body, excerpt, slugVal: it.slug, category,
        publishedAt: it.date_gmt ? `${it.date_gmt}Z` : '', updatedAt: it.modified_gmt ? `${it.modified_gmt}Z` : '',
      }))
    }
    const total = Number(res.headers.get('x-wp-totalpages') || 1)
    if (page >= total) break
  }
  return docs
}

// ── Source: quality-gated direct fetch (non-WP apps we own) ────────
async function fetchPageDoc({ url, source_type }) {
  const html = await fetch(url, { headers: { 'user-agent': 'AsquareIngest/1.0', accept: 'text/html' } }).then((r) => r.text())
  const title = decodeEntities((html.match(/<title>([^<]*)<\/title>/i)?.[1] || '').trim())
  const body = stripHtml(html, { dropChrome: true })
  return buildDoc({ url, source_type, title, body, slugVal: slug(url) })
}

// ── BigQuery helpers ──────────────────────────────────────────────
async function ensureTable(p) {
  await authedFetch(`${BQ_BASE}/projects/${p}/datasets`, { datasetReference: { datasetId: DATASET, projectId: p }, location: process.env.BQ_LOCATION || 'US' }).catch((e) => { if (!/409/.test(e.message)) throw e })
  const schema = { fields: [
    { name: 'id', type: 'STRING', mode: 'REQUIRED' }, { name: 'source_type', type: 'STRING' }, { name: 'url', type: 'STRING' },
    { name: 'title', type: 'STRING' }, { name: 'text', type: 'STRING' }, { name: 'embedding', type: 'FLOAT64', mode: 'REPEATED' },
    { name: 'model', type: 'STRING' }, { name: 'dim', type: 'INT64' }, { name: 'content_hash', type: 'STRING' },
    { name: 'word_count', type: 'INT64' }, { name: 'lang', type: 'STRING' }, { name: 'slug', type: 'STRING' },
    { name: 'category', type: 'STRING' }, { name: 'published_at', type: 'TIMESTAMP' },
    { name: 'parent_id', type: 'STRING' }, { name: 'chunk_index', type: 'INT64' }, { name: 'chunk_total', type: 'INT64' },
    { name: 'created_at', type: 'TIMESTAMP' }, { name: 'updated_at', type: 'TIMESTAMP' },
  ] }
  await authedFetch(`${BQ_BASE}/projects/${p}/datasets/${DATASET}/tables`, { tableReference: { projectId: p, datasetId: DATASET, tableId: TABLE }, schema }).catch((e) => { if (!/409/.test(e.message)) throw e })
  await ensureSchema(p)
}

// Migrate a PRE-EXISTING (legacy) table created before the metadata columns
// existed. insertAll rejects every row with "no such field" if these columns
// are missing — this is the actual cause of "insert errors: N / upserted 0".
// ADD COLUMN IF NOT EXISTS is idempotent and non-destructive (existing data
// and columns are preserved).
async function ensureSchema(p) {
  const ddl = `ALTER TABLE \`${p}.${DATASET}.${TABLE}\`
    ADD COLUMN IF NOT EXISTS content_hash STRING,
    ADD COLUMN IF NOT EXISTS word_count INT64,
    ADD COLUMN IF NOT EXISTS lang STRING,
    ADD COLUMN IF NOT EXISTS slug STRING,
    ADD COLUMN IF NOT EXISTS category STRING,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS parent_id STRING,
    ADD COLUMN IF NOT EXISTS chunk_index INT64,
    ADD COLUMN IF NOT EXISTS chunk_total INT64,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`
  await withRetry(() => authedFetch(`${BQ_BASE}/projects/${p}/queries`, { query: ddl, useLegacySql: false, timeoutMs: 60000 }), 'bq-alter')
    .then(() => console.log('  schema ensured (metadata columns present)'))
    .catch((e) => console.warn('  schema alter:', e.message.slice(0, 160)))
}

// Purge previously-ingested junk (Cloudflare challenge pages etc.) by title
// pattern, regardless of id scheme — cleans a poisoned corpus.
async function purgeJunk(p) {
  const ddl = `DELETE FROM \`${p}.${DATASET}.${TABLE}\`
    WHERE REGEXP_CONTAINS(LOWER(title), r'just a moment|checking your browser|attention required|enable javascript and cookies|cloudflare|access denied|verify you are human')
       OR title IS NULL OR ARRAY_LENGTH(embedding) != ${EMBED_DIM}`
  const j = await withRetry(() => authedFetch(`${BQ_BASE}/projects/${p}/queries`, { query: ddl, useLegacySql: false, timeoutMs: 60000 }), 'bq-purge')
    .then((r) => Number(r.numDmlAffectedRows ?? 0))
    .catch((e) => { console.warn('  purge junk (streaming buffer may defer):', e.message.slice(0, 100)); return 0 })
  console.log(`  purged ${j} junk/wrong-dim row(s)`)
}

// Count rows for a set of ids — used to CONFIRM deletion before re-insert so a
// streaming-buffer-deferred delete can't silently leave duplicate/old rows.
async function countIds(p, ids) {
  if (!ids.length) return 0
  const list = ids.map((i) => `'${i.replace(/'/g, '')}'`).join(',')
  const j = await authedFetch(`${BQ_BASE}/projects/${p}/queries`, { query: `SELECT COUNT(*) AS n FROM \`${p}.${DATASET}.${TABLE}\` WHERE id IN (${list})`, useLegacySql: false, timeoutMs: 30000 })
  return Number(j.rows?.[0]?.f?.[0]?.v ?? 0)
}

async function existingHashes(p) {
  // Fetch hash AND the ACTUAL stored vector length per row. A row counts as
  // up-to-date only if its content is unchanged AND its dimension is already
  // canonical — so a legacy/wrong-dim corpus is re-embedded automatically.
  try {
    const j = await authedFetch(`${BQ_BASE}/projects/${p}/queries`, { query: `SELECT id, content_hash, ARRAY_LENGTH(embedding) AS dim FROM \`${p}.${DATASET}.${TABLE}\``, useLegacySql: false, timeoutMs: 30000 })
    const out = {}
    for (const r of j.rows ?? []) out[r.f[0].v] = { hash: r.f[1].v, dim: Number(r.f[2].v) }
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
  const j = await withRetry(() => authedFetch(`${BQ_BASE}/projects/${p}/datasets/${DATASET}/tables/${TABLE}/insertAll`, {
    rows: rows.map((r) => ({ insertId: r.id, json: r })),
    skipInvalidRows: false,
    ignoreUnknownValues: false,
  }), 'bq-insert')
  if (j.insertErrors?.length) {
    // STOP MASKING — print the raw BigQuery per-row error payload so the exact
    // rejection reason (e.g. "no such field: content_hash") is visible.
    console.error(`  insert errors: ${j.insertErrors.length}/${rows.length} — RAW BigQuery response (first 3):`)
    console.error(JSON.stringify(j.insertErrors.slice(0, 3), null, 2))
  }
  return rows.length - (j.insertErrors?.length ?? 0)
}

// ── Pipeline ──────────────────────────────────────────────────────
;(async () => {
  const p = await project()
  console.log(`project=${p} dataset=${DATASET} table=${TABLE} model=${EMBED_MODEL} batch=${BATCH}`)
  await ensureTable(p)
  await purgeJunk(p)            // remove poisoned (Cloudflare/junk/wrong-dim) rows
  const known = await existingHashes(p)

  // 1. DISCOVER documents from structured sources (WordPress REST API +
  //    quality-gated direct fetch), VALIDATE quality, then decide what needs
  //    embedding (incremental: skip unchanged + already-768).
  console.log('Discovering content…')
  const discovered = []
  try {
    const posts = await fetchWpKind('posts'); console.log(`  WP posts: ${posts.length}`)
    const pages = await fetchWpKind('pages'); console.log(`  WP pages: ${pages.length}`)
    discovered.push(...posts, ...pages)
  } catch (e) { console.warn(`  WP REST discovery failed: ${e.message.slice(0, 80)}`) }
  for (const s of SUBDOMAINS) {
    try { discovered.push(await fetchPageDoc(s)) } catch (e) { console.warn(`  fetch ${s.url}: ${e.message.slice(0, 60)}`) }
  }

  // Validate (quality gate) on the full doc, then expand into chunks, then
  // decide per-chunk what needs embedding (incremental: skip unchanged + 768).
  const candidates = []
  let rejected = 0, chunked = 0
  const seenDocs = new Set()
  for (const d of discovered) {
    if (seenDocs.has(d.id)) continue
    seenDocs.add(d.id)
    const why = validate(d)                       // content-quality gate (task 9)
    if (why) { console.log(`  reject [${why}]: ${d.url}`); rejected++; continue }
    const units = expandToChunks(d)               // intelligent chunking (task 1)
    if (units.length > 1) chunked++
    for (const u of units) {
      const prev = known[u.id]
      if (prev && prev.hash === u.contentHash && prev.dim === EMBED_DIM) continue // unchanged
      if (prev && prev.dim !== EMBED_DIM) console.log(`  re-embed (dim ${prev.dim} -> ${EMBED_DIM}): ${u.id}`)
      candidates.push(u)
    }
  }
  console.log(`\n${discovered.length} docs discovered (${chunked} chunked), ${rejected} rejected, ${candidates.length} chunk(s) to (re)embed.`)
  if (!candidates.length) { console.log('✓ nothing new/changed — 0 Vertex calls. Corpus up to date.'); return }

  // 2. Batched embeddings (clean semantic text: title + excerpt + body).
  const now = new Date().toISOString()
  const rows = []
  for (let i = 0; i < candidates.length; i += BATCH) {
    const chunk = candidates.slice(i, i + BATCH)
    const vecs = await embedBatch(p, chunk.map((c) => c.text))
    chunk.forEach((c, k) => {
      const embedding = vecs[k] || []
      if (!embedding.length) { console.warn(`  empty embedding: ${c.id}`); return }
      rows.push({
        id: c.id, source_type: c.source_type, url: c.url, title: c.title, text: c.text,
        embedding, model: EMBED_MODEL, dim: embedding.length, content_hash: c.contentHash,
        word_count: c.wordCount, lang: c.lang, slug: c.slug, category: c.category,
        published_at: c.published_at, parent_id: c.parent_id, chunk_index: c.chunk_index,
        chunk_total: c.chunk_total, created_at: now, updated_at: now,
      })
      console.log(`  embedded ${c.source_type}/${c.slug}#${c.chunk_index} (dim ${embedding.length}, ${c.lang}, ${c.wordCount}w)`)
    })
  }

  // 3. Safe migration: DELETE existing rows for these ids → CONFIRM deletion →
  //    INSERT canonical 768-dim rows. Confirmation prevents a streaming-buffer-
  //    deferred delete from silently leaving old wrong-dim rows behind.
  const ids = rows.map((r) => r.id)
  await deleteIds(p, ids)
  const remaining = await countIds(p, ids)
  if (remaining > 0) {
    console.warn(`  ⚠ ${remaining} old row(s) still present after DELETE — almost certainly BigQuery's STREAMING BUFFER (rows streamed <~90 min ago cannot be deleted yet).`)
    console.warn('    Wait ~90 minutes since the last insert, then re-run — otherwise new 768-dim rows would coexist with the old ones.')
  } else {
    console.log(`  deletion confirmed (0 old rows remain for ${ids.length} ids)`)
  }
  const inserted = await insertRows(p, rows)

  // 4. Verify FINAL corpus dimensions directly from BigQuery (task 7).
  const dimCheck = await authedFetch(`${BQ_BASE}/projects/${p}/queries`, {
    query: `SELECT ARRAY_LENGTH(embedding) AS dim, COUNT(*) AS rows FROM \`${p}.${DATASET}.${TABLE}\` GROUP BY dim ORDER BY rows DESC`,
    useLegacySql: false, timeoutMs: 30000,
  }).catch((e) => ({ rows: [], error: e.message }))
  const dims = (dimCheck.rows ?? []).map((r) => `${r.f[0].v}-dim × ${r.f[1].v} rows`)
  console.log(`\n✓ upserted ${inserted}/${rows.length} rows into ${p}.${DATASET}.${TABLE}`)
  console.log(`Corpus dimensions now: ${dims.length ? dims.join(', ') : '(could not verify)'}`)
  if (dims.length === 1 && dims[0].startsWith(`${EMBED_DIM}-dim`)) console.log(`✓ corpus is uniformly ${EMBED_DIM}-dim — VECTOR_SEARCH ready.`)
  else if (dims.length > 1) console.warn('⚠ corpus has MIXED dimensions — re-run after the streaming buffer clears to finish migration.')
})().catch((e) => { console.error('PIPELINE FAILED:', e.message); process.exit(1) })
