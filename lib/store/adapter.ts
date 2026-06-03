// ─────────────────────────────────────────────────────────────────
// lib/store/adapter.ts
// A minimal, Firestore-shaped document store interface.
//
// Both engines (distribution + scam-intel) persist ONLY through this
// interface, so the storage backend is a single swap:
//   - dev / tests / Vercel preview → MemoryStore (file-backed)
//   - production                   → FirestoreStore (REST adapter)
//
// The method shapes (collection/doc, where, orderBy, limit) mirror the
// Firebase Web SDK so migration is mechanical.
// ─────────────────────────────────────────────────────────────────

export type DocData = Record<string, unknown>

export type WhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains'

export interface QueryFilter {
  field: string
  op: WhereOp
  value: unknown
}

export interface QueryOptions {
  where?: QueryFilter[]
  orderBy?: { field: string; dir?: 'asc' | 'desc' }
  limit?: number
  offset?: number
}

export interface StoredDoc<T extends object = DocData> {
  id: string
  data: T
}

export interface DocumentStore {
  readonly name: string
  /** Create or fully overwrite a document. Generates an id when omitted. */
  set<T extends object = DocData>(collection: string, id: string | null, data: T): Promise<string>
  /** Merge fields into an existing document (creates if absent). */
  update<T extends object = DocData>(collection: string, id: string, patch: Partial<T>): Promise<void>
  get<T extends object = DocData>(collection: string, id: string): Promise<StoredDoc<T> | null>
  query<T extends object = DocData>(collection: string, opts?: QueryOptions): Promise<StoredDoc<T>[]>
  delete(collection: string, id: string): Promise<void>
  /** Atomic-ish numeric increment for counters (rate limits, metrics). */
  increment(collection: string, id: string, field: string, by: number): Promise<number>
}

// ── Shared query evaluation (used by every in-process backend) ─────
export function matchesFilters(data: object, filters: QueryFilter[] = []): boolean {
  return filters.every((f) => {
    const v = getPath(data, f.field)
    switch (f.op) {
      case '==': return v === f.value
      case '!=': return v !== f.value
      case '<': return (v as number) < (f.value as number)
      case '<=': return (v as number) <= (f.value as number)
      case '>': return (v as number) > (f.value as number)
      case '>=': return (v as number) >= (f.value as number)
      case 'in': return Array.isArray(f.value) && f.value.includes(v)
      case 'array-contains': return Array.isArray(v) && v.includes(f.value)
      default: return false
    }
  })
}

export function applyQuery<T extends object = DocData>(
  rows: StoredDoc<T>[],
  opts: QueryOptions = {},
): StoredDoc<T>[] {
  let out = rows.filter((r) => matchesFilters(r.data, opts.where))
  if (opts.orderBy) {
    const { field, dir = 'asc' } = opts.orderBy
    out = [...out].sort((a, b) => {
      const av = getPath(a.data, field) as number | string
      const bv = getPath(b.data, field) as number | string
      if (av === bv) return 0
      const cmp = av < bv ? -1 : 1
      return dir === 'asc' ? cmp : -cmp
    })
  }
  if (opts.offset) out = out.slice(opts.offset)
  if (opts.limit != null) out = out.slice(0, opts.limit)
  return out
}

export function getPath(obj: object, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

export function genId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const ts = Date.now().toString(36)
  return `${prefix}${ts}${rand}`
}

// ── Backend selection ──────────────────────────────────────────────
import { MemoryStore } from './memory-store'
import { FirestoreStore } from './firestore-adapter'

let _store: DocumentStore | null = null

export function getStore(): DocumentStore {
  if (_store) return _store
  const useFirestore =
    !!process.env.FIREBASE_PROJECT_ID && !!process.env.FIREBASE_API_KEY
  _store = useFirestore ? new FirestoreStore() : new MemoryStore()
  return _store
}

export function setStore(s: DocumentStore | null): void {
  _store = s
}
