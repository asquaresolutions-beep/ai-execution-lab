// ─────────────────────────────────────────────────────────────────
// lib/scamcheck/scan-history.ts
// Per-user scan history for the dashboard. Stored as ONE capped document per
// user (items as a JSON string) → no composite Firestore index required, and
// robust across the memory/Firestore stores. Best-effort (never blocks a scan).
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'

const COLLECTION = '_scans'
const CAP = 50

export interface ScanEntry { ts: number; type: string; verdict: string; risk: number; label?: string }
export interface ScanHistory { items: ScanEntry[]; total: number; lastAt: number | null }

export async function recordScan(uid: string, entry: ScanEntry): Promise<void> {
  try {
    const store = getStore()
    const doc = await store.get<{ items?: string; total?: number }>(COLLECTION, uid)
    const items: ScanEntry[] = doc?.data?.items ? JSON.parse(doc.data.items) : []
    const next = [entry, ...items].slice(0, CAP)
    await store.set(COLLECTION, uid, { items: JSON.stringify(next), total: (Number(doc?.data?.total) || 0) + 1, lastAt: entry.ts })
  } catch { /* history is best-effort */ }
}

export async function getHistory(uid: string): Promise<ScanHistory> {
  try {
    const doc = await getStore().get<{ items?: string; total?: number; lastAt?: number }>(COLLECTION, uid)
    const items: ScanEntry[] = doc?.data?.items ? JSON.parse(doc.data.items) : []
    return { items, total: Number(doc?.data?.total) || items.length, lastAt: doc?.data?.lastAt ? Number(doc.data.lastAt) : (items[0]?.ts ?? null) }
  } catch { return { items: [], total: 0, lastAt: null } }
}
