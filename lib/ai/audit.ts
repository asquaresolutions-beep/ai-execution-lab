// ─────────────────────────────────────────────────────────────────
// lib/ai/audit.ts
// Append-only audit log for every AI generation, moderation decision,
// queue transition, and admin action. Persisted via the store so it is
// queryable from the admin dashboards and survives on Firestore.
// ─────────────────────────────────────────────────────────────────

import { getStore } from '@/lib/store/adapter'

export type AuditAction =
  | 'ai.generate'
  | 'ai.cache_hit'
  | 'ai.error'
  | 'distribution.bundle'
  | 'queue.enqueue'
  | 'queue.transition'
  | 'queue.publish'
  | 'ingest.received'
  | 'ingest.duplicate'
  | 'ingest.classified'
  | 'moderation.decision'
  | 'moderation.flag'
  | 'admin.action'
  | 'claim.start'
  | 'claim.verified'
  | 'claim.failed'
  | 'claim.revoked'
  | 'claim.removed'
  | 'billing.activate'
  | 'billing.renew'
  | 'billing.past_due'
  | 'billing.halted'
  | 'billing.cancel'
  | 'billing.expire'
  | 'billing.reconcile'
  | 'billing.unmapped'

export interface AuditEntry {
  id?: string
  ts: number
  action: AuditAction
  actor: string            // 'system' | admin id | 'public:<ip-hash>'
  subject?: string         // entity id this entry concerns
  meta?: Record<string, unknown>
  ok: boolean
  message?: string
}

const COLLECTION = 'audit_log'

export async function audit(entry: Omit<AuditEntry, 'ts' | 'id'> & { ts?: number }): Promise<void> {
  const record: AuditEntry = { ts: Date.now(), ...entry }
  try {
    await getStore().set<AuditEntry>(COLLECTION, null, record as unknown as AuditEntry)
  } catch {
    // Never let audit failures break the primary operation.
  }
}

export async function recentAudit(limit = 100, action?: AuditAction): Promise<AuditEntry[]> {
  const rows = await getStore().query<AuditEntry>(COLLECTION, {
    where: action ? [{ field: 'action', op: '==', value: action }] : undefined,
    orderBy: { field: 'ts', dir: 'desc' },
    limit,
  })
  return rows.map((r) => r.data)
}
