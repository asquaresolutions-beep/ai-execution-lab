// ─────────────────────────────────────────────────────────────────
// lib/distribution/queue.ts
// Publishing queue. A ContentBundle is enqueued per target channel; a
// worker (cron / route handler) drains due jobs, calls the channel
// integration, and records the result. State machine:
//   queued -> processing -> published | failed (-> retry -> queued)
// ─────────────────────────────────────────────────────────────────

import { getStore, genId, type StoredDoc } from '@/lib/store/adapter'
import { audit } from '@/lib/ai/audit'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/ai/rate-limit'
import { log } from '@/lib/observability/logger'
import { deadLetter } from './dlq'
import { allowPublish } from './throttle'
import { publishToChannel, type Channel } from './integrations'

export type QueueStatus = 'queued' | 'processing' | 'published' | 'failed'

export interface QueueJob {
  id: string
  bundleId: string
  channel: Channel
  locale: 'en' | 'hi'
  status: QueueStatus
  runAt: number          // scheduled timestamp (supports future scheduling)
  attempts: number
  maxAttempts: number
  createdAt: number
  updatedAt: number
  lastError?: string
  result?: Record<string, unknown>
}

const COLLECTION = 'publish_queue'
const MAX_ATTEMPTS = 3

export interface EnqueueOptions {
  channels: Channel[]
  locale?: 'en' | 'hi'
  runAt?: number
}

export async function enqueue(bundleId: string, opts: EnqueueOptions): Promise<QueueJob[]> {
  const store = getStore()
  const now = Date.now()
  const jobs: QueueJob[] = []
  for (const channel of opts.channels) {
    const job: QueueJob = {
      id: genId('job_'),
      bundleId,
      channel,
      locale: opts.locale ?? 'en',
      status: 'queued',
      runAt: opts.runAt ?? now,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      createdAt: now,
      updatedAt: now,
    }
    await store.set(COLLECTION, job.id, job as unknown as Record<string, unknown>)
    jobs.push(job)
    await audit({ action: 'queue.enqueue', actor: 'system', subject: job.id, ok: true, meta: { bundleId, channel } })
  }
  return jobs
}

/** Drain due jobs. Call from a cron route. Returns processed jobs. */
export async function drainQueue(max = 10): Promise<QueueJob[]> {
  await enforceRateLimit({ key: 'queue:drain', ...RATE_LIMITS.queueDrain })
  const store = getStore()
  const now = Date.now()
  const due = (await store.query<QueueJob>(COLLECTION, {
    where: [{ field: 'status', op: '==', value: 'queued' }],
    orderBy: { field: 'runAt', dir: 'asc' },
    limit: max,
  })).map((r) => r.data).filter((j) => j.runAt <= now)

  const processed: QueueJob[] = []
  for (const job of due) {
    processed.push(await processJob(job))
  }
  return processed
}

async function processJob(job: QueueJob): Promise<QueueJob> {
  const store = getStore()
  // Publish throttle: if over budget, requeue shortly WITHOUT consuming a
  // retry attempt. Keeps spend/posting cadence predictable on hobby plans.
  if (!(await allowPublish())) {
    const patch: Partial<QueueJob> = { status: 'queued', runAt: Date.now() + 5 * 60_000, updatedAt: Date.now() }
    await store.update(COLLECTION, job.id, patch)
    log.info({ event: 'queue.throttled', jobId: job.id, channel: job.channel })
    return { ...job, ...patch } as QueueJob
  }
  await transition(job, 'processing')
  try {
    const startedAt = Date.now()
    const result = await publishToChannel(job.channel, job.bundleId, job.locale)
    const done: Partial<QueueJob> = {
      status: 'published', result, updatedAt: Date.now(), attempts: job.attempts + 1,
    }
    await store.update(COLLECTION, job.id, done)
    log.info({ event: 'queue.publish', jobId: job.id, channel: job.channel, bundleId: job.bundleId, ms: Date.now() - startedAt })
    await audit({ action: 'queue.publish', actor: 'system', subject: job.id, ok: true, meta: { channel: job.channel } })
    return { ...job, ...done } as QueueJob
  } catch (err) {
    const attempts = job.attempts + 1
    const exhausted = attempts >= job.maxAttempts
    const patch: Partial<QueueJob> = {
      status: exhausted ? 'failed' : 'queued',
      attempts,
      runAt: exhausted ? job.runAt : Date.now() + backoff(attempts),
      lastError: (err as Error).message,
      updatedAt: Date.now(),
    }
    await store.update(COLLECTION, job.id, patch)
    const updated = { ...job, ...patch } as QueueJob
    log.warn({ event: 'queue.attempt_failed', jobId: job.id, channel: job.channel, attempts, exhausted, error: (err as Error).message })
    await audit({ action: 'queue.transition', actor: 'system', subject: job.id, ok: false, message: (err as Error).message, meta: { attempts, exhausted } })
    // Route exhausted jobs to the dead-letter queue for inspection/replay.
    if (exhausted) await deadLetter(updated)
    return updated
  }
}

async function transition(job: QueueJob, status: QueueStatus): Promise<void> {
  await getStore().update(COLLECTION, job.id, { status, updatedAt: Date.now() })
  await audit({ action: 'queue.transition', actor: 'system', subject: job.id, ok: true, meta: { to: status } })
}

export async function listJobs(status?: QueueStatus, limit = 100): Promise<QueueJob[]> {
  const rows: StoredDoc<QueueJob>[] = await getStore().query<QueueJob>(COLLECTION, {
    where: status ? [{ field: 'status', op: '==', value: status }] : undefined,
    orderBy: { field: 'createdAt', dir: 'desc' },
    limit,
  })
  return rows.map((r) => r.data)
}

function backoff(attempt: number): number {
  return Math.min(60 * 60_000, 1000 * 2 ** attempt) // exp backoff, cap 1h
}
