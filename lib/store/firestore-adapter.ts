// ─────────────────────────────────────────────────────────────────
// lib/store/firestore-adapter.ts
// Production DocumentStore backed by Cloud Firestore over the REST API
// (no firebase npm dependency). Activates when FIREBASE_PROJECT_ID and
// FIREBASE_API_KEY are set.
//
// This adapter implements the full DocumentStore contract. Firestore's
// REST `runQuery` (structuredQuery) covers where/orderBy/limit; complex
// composite filters that Firestore cannot index are evaluated in-process
// via applyQuery as a safety net.
//
// NOTE: For server-to-server use, prefer a service-account bearer token
// (FIREBASE_ACCESS_TOKEN) over the API key. Both paths are supported.
// ─────────────────────────────────────────────────────────────────

import {
  type DocumentStore,
  type DocData,
  type StoredDoc,
  type QueryOptions,
  applyQuery,
  genId,
} from './adapter'
import { getAccessToken, hasVertexAuth } from '@/lib/ai/vertex-auth'

const PROJECT = process.env.FIREBASE_PROJECT_ID || ''
const API_KEY = process.env.FIREBASE_API_KEY || ''
const ACCESS_TOKEN = process.env.FIREBASE_ACCESS_TOKEN || ''
const DB = process.env.FIREBASE_DATABASE_ID || '(default)'
const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB}/documents`

export class FirestoreStore implements DocumentStore {
  readonly name = 'firestore'

  // Auth precedence: explicit FIREBASE_ACCESS_TOKEN → service-account/ADC token
  // (admin-level, BYPASSES security rules → credits persist with locked rules)
  // → API key (rules-governed fallback). Tokens are cached by getAccessToken().
  private async bearer(): Promise<string> {
    if (ACCESS_TOKEN) return ACCESS_TOKEN
    if (hasVertexAuth()) { try { return await getAccessToken() } catch { return '' } }
    return ''
  }
  private async auth(): Promise<{ qs: string; headers: Record<string, string> }> {
    const t = await this.bearer()
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (t) { headers.authorization = `Bearer ${t}`; return { qs: '', headers } }
    return { qs: `?key=${API_KEY}`, headers }
  }

  async set<T extends object = DocData>(collection: string, id: string | null, data: T): Promise<string> {
    const docId = id || genId()
    const { qs, headers } = await this.auth()
    const url = `${ROOT}/${collection}/${docId}${qs}`
    const res = await fetch(url, {
      method: 'PATCH', // PATCH on a named doc = create-or-replace
      headers,
      body: JSON.stringify({ fields: toFirestoreFields({ ...data, id: docId }) }),
    })
    if (!res.ok) throw new Error(`Firestore set ${res.status}: ${await res.text()}`)
    return docId
  }

  async update<T extends object = DocData>(collection: string, id: string, patch: Partial<T>): Promise<void> {
    const mask = Object.keys(patch).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
    const { qs, headers } = await this.auth()
    const url = `${ROOT}/${collection}/${id}?${qs ? `${qs.slice(1)}&` : ''}${mask}`
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields: toFirestoreFields(patch as DocData) }),
    })
    if (!res.ok) throw new Error(`Firestore update ${res.status}: ${await res.text()}`)
  }

  async get<T extends object = DocData>(collection: string, id: string): Promise<StoredDoc<T> | null> {
    const { qs, headers } = await this.auth()
    const res = await fetch(`${ROOT}/${collection}/${id}${qs}`, { headers })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Firestore get ${res.status}`)
    const doc = (await res.json()) as FirestoreDoc
    return { id, data: fromFirestoreFields(doc.fields) as T }
  }

  async query<T extends object = DocData>(collection: string, opts: QueryOptions = {}): Promise<StoredDoc<T>[]> {
    const structured: Record<string, unknown> = { from: [{ collectionId: collection }] }
    if (opts.where?.length) {
      structured.where = {
        compositeFilter: {
          op: 'AND',
          filters: opts.where.map((w) => ({
            fieldFilter: {
              field: { fieldPath: w.field },
              op: FS_OP[w.op],
              value: toFirestoreValue(w.value),
            },
          })),
        },
      }
    }
    if (opts.orderBy) {
      structured.orderBy = [{
        field: { fieldPath: opts.orderBy.field },
        direction: opts.orderBy.dir === 'desc' ? 'DESCENDING' : 'ASCENDING',
      }]
    }
    if (opts.limit != null) structured.limit = opts.limit
    if (opts.offset) structured.offset = opts.offset

    const { qs, headers } = await this.auth()
    const res = await fetch(`${ROOT}:runQuery${qs}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ structuredQuery: structured }),
    })
    if (!res.ok) throw new Error(`Firestore query ${res.status}: ${await res.text()}`)
    const rows = (await res.json()) as Array<{ document?: FirestoreDoc }>
    const docs: StoredDoc<T>[] = rows
      .filter((r) => r.document)
      .map((r) => {
        const name = r.document!.name || ''
        const id = name.split('/').pop() || genId()
        return { id, data: fromFirestoreFields(r.document!.fields) as T }
      })
    // Defensive: re-apply unsupported filters in-process.
    return applyQuery(docs, opts)
  }

  async delete(collection: string, id: string): Promise<void> {
    const { qs, headers } = await this.auth()
    const res = await fetch(`${ROOT}/${collection}/${id}${qs}`, {
      method: 'DELETE',
      headers,
    })
    if (!res.ok && res.status !== 404) throw new Error(`Firestore delete ${res.status}`)
  }

  async increment(collection: string, id: string, field: string, by: number): Promise<number> {
    // Firestore supports server-side transforms; use commit with increment.
    const { qs, headers } = await this.auth()
    const url = `${ROOT.replace('/documents', '')}/documents:commit${qs}`
    const docPath = `projects/${PROJECT}/databases/${DB}/documents/${collection}/${id}`
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        writes: [{
          transform: {
            document: docPath,
            fieldTransforms: [{ fieldPath: field, increment: { integerValue: String(by) } }],
          },
        }],
      }),
    })
    if (!res.ok) throw new Error(`Firestore increment ${res.status}: ${await res.text()}`)
    // Read back the new value.
    const doc = await this.get(collection, id)
    return (doc?.data?.[field] as number) ?? by
  }
}

// ── Firestore typed-value (de)serialisation ────────────────────────
const FS_OP: Record<string, string> = {
  '==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL',
  '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL', 'in': 'IN', 'array-contains': 'ARRAY_CONTAINS',
}

interface FirestoreDoc {
  name?: string
  fields?: Record<string, FirestoreValue>
}
type FirestoreValue = Record<string, unknown>

function toFirestoreValue(v: unknown): FirestoreValue {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } }
  if (typeof v === 'object') return { mapValue: { fields: toFirestoreFields(v as DocData) } }
  return { stringValue: String(v) }
}

function toFirestoreFields(obj: DocData): Record<string, FirestoreValue> {
  const out: Record<string, FirestoreValue> = {}
  for (const [k, v] of Object.entries(obj)) out[k] = toFirestoreValue(v)
  return out
}

function fromFirestoreValue(v: FirestoreValue): unknown {
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('arrayValue' in v) {
    const vals = (v.arrayValue as { values?: FirestoreValue[] })?.values ?? []
    return vals.map(fromFirestoreValue)
  }
  if ('mapValue' in v) {
    const fields = (v.mapValue as { fields?: Record<string, FirestoreValue> })?.fields ?? {}
    return fromFirestoreFields(fields)
  }
  return null
}

function fromFirestoreFields(fields: Record<string, FirestoreValue> = {}): DocData {
  const out: DocData = {}
  for (const [k, v] of Object.entries(fields)) out[k] = fromFirestoreValue(v)
  return out
}
