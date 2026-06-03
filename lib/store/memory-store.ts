// ─────────────────────────────────────────────────────────────────
// lib/store/memory-store.ts
// In-process DocumentStore with optional JSON file persistence.
// Default backend for dev / tests / preview. Data survives within a
// single server process; set STORE_FILE to persist to disk across runs.
// ─────────────────────────────────────────────────────────────────

import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  type DocumentStore,
  type DocData,
  type StoredDoc,
  type QueryOptions,
  applyQuery,
  genId,
} from './adapter'

const STORE_FILE = process.env.STORE_FILE || ''

export class MemoryStore implements DocumentStore {
  readonly name = 'memory'
  private db = new Map<string, Map<string, DocData>>()
  private loaded = false

  private col(name: string): Map<string, DocData> {
    let c = this.db.get(name)
    if (!c) {
      c = new Map()
      this.db.set(name, c)
    }
    return c
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded || !STORE_FILE) {
      this.loaded = true
      return
    }
    try {
      const raw = await fs.readFile(STORE_FILE, 'utf8')
      const parsed = JSON.parse(raw) as Record<string, Record<string, DocData>>
      for (const [col, docs] of Object.entries(parsed)) {
        this.db.set(col, new Map(Object.entries(docs)))
      }
    } catch {
      /* first run — no file yet */
    }
    this.loaded = true
  }

  private async persist(): Promise<void> {
    if (!STORE_FILE) return
    const obj: Record<string, Record<string, DocData>> = {}
    for (const [col, docs] of this.db) obj[col] = Object.fromEntries(docs)
    await fs.mkdir(path.dirname(STORE_FILE), { recursive: true })
    await fs.writeFile(STORE_FILE, JSON.stringify(obj, null, 2), 'utf8')
  }

  async set<T extends object = DocData>(collection: string, id: string | null, data: T): Promise<string> {
    await this.ensureLoaded()
    const docId = id || genId()
    this.col(collection).set(docId, { ...data, id: docId } as DocData)
    await this.persist()
    return docId
  }

  async update<T extends object = DocData>(collection: string, id: string, patch: Partial<T>): Promise<void> {
    await this.ensureLoaded()
    const c = this.col(collection)
    const existing = c.get(id) ?? { id }
    c.set(id, { ...existing, ...patch } as DocData)
    await this.persist()
  }

  async get<T extends object = DocData>(collection: string, id: string): Promise<StoredDoc<T> | null> {
    await this.ensureLoaded()
    const data = this.col(collection).get(id)
    return data ? { id, data: data as unknown as T } : null
  }

  async query<T extends object = DocData>(collection: string, opts: QueryOptions = {}): Promise<StoredDoc<T>[]> {
    await this.ensureLoaded()
    const rows: StoredDoc<T>[] = [...this.col(collection).entries()].map(
      ([id, data]) => ({ id, data: data as unknown as T }),
    )
    return applyQuery(rows, opts)
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.ensureLoaded()
    this.col(collection).delete(id)
    await this.persist()
  }

  async increment(collection: string, id: string, field: string, by: number): Promise<number> {
    await this.ensureLoaded()
    const c = this.col(collection)
    const existing = c.get(id) ?? { id }
    const next = ((existing[field] as number) || 0) + by
    c.set(id, { ...existing, [field]: next })
    await this.persist()
    return next
  }
}
