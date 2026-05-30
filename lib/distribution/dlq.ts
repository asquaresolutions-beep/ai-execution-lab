// ─────────────────────────────────────────────────────────────────
// lib/distribution/dlq.ts
// Dead-letter queue. Jobs that exhaust their retry budget are moved here
// (collection `publish_dlq`) instead of silently rotting in the queue.
// Operators can inspect, replay (re-enqueue), or discard them.
// ─────────────────────────────────────────────────────────────────

import { getStore, genId } from '@/lib/store/adapter'
import { audit } from '@/lib/ai/audit'
import { log } from '@/lib/observability/logger'
import type { QueueJob } from './queue'

const DLQ = 'publish_dlq'

export interface DeadLetter {
  id: string
  originalJobId: string
  bundleId: string
  channel: string
  locale: string
  attempts: number
  lastError: string
  deadLetteredAt: number
  replayedAt?: number
  replayJobId?: string
}

export async function deadLetter(job: QueueJob): Promise<DeadLetter> {
  const entry: DeadLetter = {
    id: genId('dlq_'),
    originalJobId: job.id,
    bundleId: job.bundleId,
    channel: job.channel,
    locale: job.locale,
    attempts: job.attempts,
    lastError: job.lastError ?? 'unknown',
    deadLetteredAt: Date.now(),
  }
  await getStore().set(DLQ, entry.id, entry as unknown as Record<string, unknown>)
  log.error({ event: 'queue.dead_letter', jobId: job.id, channel: job.channel, bundleId: job.bundleId, error: entry.lastError })
  await audit({ action: 'queue.transition', actor: 'system', subject: job.id, ok: false, message: 'dead-lettered', meta: { dlqId: entry.id, channel: job.channel } })
  return entry
}

export async function listDeadLetters(limit = 100): Promise<DeadLetter[]> {
  const rows = await getStore().query<DeadLetter>(DLQ, {
    orderBy: { field: 'deadLetteredAt', dir: 'desc' }, limit,
  })
  return rows.map((r) => r.data)
}

export async function dlqSize(): Promise<number> {
  return (await getStore().query<DeadLetter>(DLQ, { limit: 1000 })).length
}

/** Re-enqueue a dead letter as a fresh job and mark it replayed. */
export async function replayDeadLetter(dlqId: string): Promise<{ replayed: boolean; jobId?: string }> {
  const { enqueue } = await import('./queue') // avoid circular import at module load
  const doc = await getStore().get<DeadLetter>(DLQ, dlqId)
  if (!doc) return { replayed: false }
  const dl = doc.data
  if (dl.replayedAt) return { replayed: false }
  const [job] = await enqueue(dl.bundleId, { channels: [dl.channel as never], locale: dl.locale as 'en' | 'hi' })
  await getStore().update(DLQ, dlqId, { replayedAt: Date.now(), replayJobId: job.id })
  log.info({ event: 'queue.dlq_replay', dlqId, newJobId: job.id, channel: dl.channel })
  await audit({ action: 'queue.enqueue', actor: 'admin', subject: job.id, ok: true, message: 'dlq-replay', meta: { dlqId } })
  return { replayed: true, jobId: job.id }
}

export async function discardDeadLetter(dlqId: string): Promise<void> {
  await getStore().delete(DLQ, dlqId)
  log.info({ event: 'queue.dlq_discard', dlqId })
}
