// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/firestore-schema.ts
// Single source of truth for Firestore collections + the composite /
// vector indexes both engines require. Consumed by docs and by the
// `scripts/` deploy helper that emits firestore.indexes.json.
//
// This file is intentionally data-only (no runtime cost) so it can be
// imported anywhere for validation or codegen.
// ─────────────────────────────────────────────────────────────────

export interface CollectionSpec {
  name: string
  description: string
  /** Primary access patterns this collection must serve. */
  queries: string[]
  /** Composite indexes (field + order) needed for those queries. */
  compositeIndexes: Array<{ fields: Array<{ field: string; order: 'ASCENDING' | 'DESCENDING' }> }>
  /** Vector index config, when the collection stores embeddings. */
  vectorIndex?: { field: string; dimension: number; metric: 'COSINE' | 'DOT_PRODUCT' | 'EUCLIDEAN' }
  ttlField?: string
}

export const EMBED_DIMENSION = 768

export const COLLECTIONS: CollectionSpec[] = [
  {
    name: 'scam_reports',
    description: 'Processed, PII-redacted scam reports. One per submission.',
    queries: [
      'feed: status==approved order by createdAt desc',
      'queue: status==pending order by createdAt desc',
      'facet: status==approved && category==X order by createdAt desc',
      'semantic: vector KNN over approved reports',
    ],
    compositeIndexes: [
      { fields: [{ field: 'status', order: 'ASCENDING' }, { field: 'createdAt', order: 'DESCENDING' }] },
      { fields: [{ field: 'status', order: 'ASCENDING' }, { field: 'category', order: 'ASCENDING' }, { field: 'createdAt', order: 'DESCENDING' }] },
      { fields: [{ field: 'status', order: 'ASCENDING' }, { field: 'region', order: 'ASCENDING' }, { field: 'createdAt', order: 'DESCENDING' }] },
    ],
    vectorIndex: { field: 'vector', dimension: EMBED_DIMENSION, metric: 'COSINE' },
  },
  {
    name: 'scam_clusters',
    description: 'Deduplicated scam patterns. Centroid + rollups for trending.',
    queries: [
      'cluster match: category==X (then in-process / vector KNN on centroid)',
      'trending: order by trendScore desc',
    ],
    compositeIndexes: [
      { fields: [{ field: 'category', order: 'ASCENDING' }, { field: 'lastSeen', order: 'DESCENDING' }] },
      { fields: [{ field: 'trendScore', order: 'DESCENDING' }] },
    ],
    vectorIndex: { field: 'centroid', dimension: EMBED_DIMENSION, metric: 'COSINE' },
  },
  {
    name: 'content_bundles',
    description: 'Generated distribution bundles (article + social + schema).',
    queries: ['list: order by createdAt desc', 'get by id'],
    compositeIndexes: [{ fields: [{ field: 'createdAt', order: 'DESCENDING' }] }],
  },
  {
    name: 'alerts',
    description: 'Lightweight index of published alerts for internal-linking.',
    queries: ['similarity over vector', 'facet by platform/region'],
    compositeIndexes: [{ fields: [{ field: 'platform', order: 'ASCENDING' }, { field: 'publishedAt', order: 'DESCENDING' }] }],
    vectorIndex: { field: 'vector', dimension: EMBED_DIMENSION, metric: 'COSINE' },
  },
  {
    name: 'publish_queue',
    description: 'Per-channel publishing jobs with retry/backoff.',
    queries: ['drain: status==queued order by runAt asc', 'list by status'],
    compositeIndexes: [
      { fields: [{ field: 'status', order: 'ASCENDING' }, { field: 'runAt', order: 'ASCENDING' }] },
      { fields: [{ field: 'status', order: 'ASCENDING' }, { field: 'createdAt', order: 'DESCENDING' }] },
    ],
  },
  {
    name: 'audit_log',
    description: 'Append-only audit trail of all AI + admin actions.',
    queries: ['recent: order by ts desc', 'by action: action==X order by ts desc'],
    compositeIndexes: [
      { fields: [{ field: 'ts', order: 'DESCENDING' }] },
      { fields: [{ field: 'action', order: 'ASCENDING' }, { field: 'ts', order: 'DESCENDING' }] },
    ],
  },
  {
    name: '_ai_cache',
    description: 'Content-addressed AI generation cache. TTL-expired.',
    queries: ['get by key'],
    compositeIndexes: [],
    ttlField: 'expiresAt',
  },
  {
    name: '_rate_limits',
    description: 'Fixed-window counters for rate limiting + publish throttle. TTL-expired.',
    queries: ['get/increment by key'],
    compositeIndexes: [],
    ttlField: 'resetAt',
  },
  {
    name: 'publish_dlq',
    description: 'Dead-letter queue: jobs that exhausted retries. Inspect/replay/discard.',
    queries: ['list: order by deadLetteredAt desc'],
    compositeIndexes: [], // single-field (deadLetteredAt) is automatic
  },
  {
    name: 'error_reports',
    description: 'Structured error reports (fingerprinted) for the analytics dashboard.',
    queries: ['recent: order by ts desc'],
    compositeIndexes: [],
  },
  {
    name: 'trending_snapshots',
    description: 'Materialized trending lists written by the update-trending cron.',
    queries: ['get latest by id'],
    compositeIndexes: [],
  },
  {
    name: '_ai_usage_daily',
    description: 'Per-day, per-tier token + cost counters (increment-only; no scans).',
    queries: ['by day: day==X'],
    compositeIndexes: [],
  },
  {
    name: '_ai_quota',
    description: 'Per-minute token counters for Vertex quota monitoring. Ephemeral.',
    queries: ['get by tier+minute'],
    compositeIndexes: [],
    ttlField: 'minute',
  },
]

/** Emit a firestore.indexes.json-compatible object. */
export function toFirestoreIndexesJson(): object {
  const indexes = COLLECTIONS.flatMap((c) =>
    c.compositeIndexes
      .filter((idx) => idx.fields.length > 1) // single-field indexes are automatic
      .map((idx) => ({ collectionGroup: c.name, queryScope: 'COLLECTION', fields: idx.fields.map((f) => ({ fieldPath: f.field, order: f.order })) })),
  )
  return { indexes, fieldOverrides: [] }
}

/** Vector indexes (created via gcloud, not firestore.indexes.json). */
export function vectorIndexCommands(): string[] {
  return COLLECTIONS.filter((c) => c.vectorIndex).map((c) => {
    const v = c.vectorIndex!
    return `gcloud firestore indexes composite create --collection-group=${c.name} ` +
      `--query-scope=COLLECTION --field-config=field-path=${v.field},vector-config='{"dimension":${v.dimension},"flat":{}}'`
  })
}
