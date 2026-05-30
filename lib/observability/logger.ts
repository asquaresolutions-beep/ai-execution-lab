// ─────────────────────────────────────────────────────────────────
// lib/observability/logger.ts
// Structured JSON logging. One line per event = clean ingestion by
// Vercel log drains / Datadog / Logflare without a vendor SDK. In dev
// it prints compact human-readable lines.
// ─────────────────────────────────────────────────────────────────

import { env } from '@/lib/env'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const MIN = LEVEL_ORDER[(env.logLevel as LogLevel)] ?? LEVEL_ORDER.info

export interface LogFields {
  event: string
  [k: string]: unknown
}

function emit(level: LogLevel, fields: LogFields): void {
  if (LEVEL_ORDER[level] < MIN) return
  const record = {
    level,
    ts: new Date().toISOString(),
    service: 'ai-execution-lab',
    ...fields,
  }
  const line = JSON.stringify(record, replacer)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

// Avoid logging huge payloads / secrets.
function replacer(key: string, value: unknown): unknown {
  if (/token|secret|apikey|api_key|password|authorization/i.test(key)) return '[redacted]'
  if (typeof value === 'string' && value.length > 500) return value.slice(0, 500) + '…'
  if (Array.isArray(value) && value.length > 50) return value.slice(0, 50)
  return value
}

export const log = {
  debug: (f: LogFields) => emit('debug', f),
  info: (f: LogFields) => emit('info', f),
  warn: (f: LogFields) => emit('warn', f),
  error: (f: LogFields) => emit('error', f),
}

/** Time an async operation and log its duration + outcome. */
export async function timed<T>(event: string, fn: () => Promise<T>, extra: Record<string, unknown> = {}): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    log.info({ event, ok: true, ms: Date.now() - start, ...extra })
    return result
  } catch (err) {
    log.error({ event, ok: false, ms: Date.now() - start, error: (err as Error).message, ...extra })
    throw err
  }
}
