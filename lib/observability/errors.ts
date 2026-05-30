// ─────────────────────────────────────────────────────────────────
// lib/observability/errors.ts
// Structured error reporting. Every reported error is (a) logged as
// structured JSON and (b) persisted to `error_reports` for the analytics
// dashboard. `withErrorReporting` wraps API handlers so any throw becomes
// a clean JSON 500 + a durable record, never a stack-trace leak.
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store/adapter'
import { log } from './logger'

export type ErrorSeverity = 'warning' | 'error' | 'critical'

export interface ErrorReport {
  id?: string
  ts: number
  scope: string            // e.g. 'api.distribution.generate', 'queue.process'
  message: string
  severity: ErrorSeverity
  status?: number
  fingerprint: string      // groups recurring errors
  meta?: Record<string, unknown>
}

const COLLECTION = 'error_reports'

export async function reportError(
  scope: string,
  err: unknown,
  opts: { severity?: ErrorSeverity; status?: number; meta?: Record<string, unknown> } = {},
): Promise<string> {
  const message = err instanceof Error ? err.message : String(err)
  const report: ErrorReport = {
    ts: Date.now(),
    scope,
    message,
    severity: opts.severity ?? 'error',
    status: opts.status,
    fingerprint: fingerprint(scope, message),
    meta: opts.meta,
  }
  log.error({ event: 'error.report', scope, message, severity: report.severity, status: opts.status, ...opts.meta })
  try {
    return await getStore().set<ErrorReport>(COLLECTION, null, report)
  } catch {
    return '' // store unavailable — the log line is the durable record.
  }
}

export async function recentErrors(limit = 50): Promise<ErrorReport[]> {
  const rows = await getStore().query<ErrorReport>(COLLECTION, {
    orderBy: { field: 'ts', dir: 'desc' }, limit,
  })
  return rows.map((r) => r.data)
}

/** Wrap a route handler: catches, reports, returns a safe JSON 500. */
export function withErrorReporting<A extends unknown[]>(
  scope: string,
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args)
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500
      await reportError(scope, err, { status, severity: status >= 500 ? 'error' : 'warning' })
      return NextResponse.json(
        { error: 'internal_error', scope, message: (err as Error).message },
        { status },
      )
    }
  }
}

function fingerprint(scope: string, message: string): string {
  // Normalise ids/numbers so the same error groups together.
  const norm = message.replace(/[0-9a-f]{6,}/gi, '*').replace(/\d+/g, '#').slice(0, 120)
  let h = 0x811c9dc5
  const s = `${scope}|${norm}`
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36)
}
