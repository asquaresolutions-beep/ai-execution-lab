// ─────────────────────────────────────────────────────────────────
// lib/api/json.ts
// Guarantees API routes ALWAYS return structured JSON — never an HTML error
// page or an uncaught exception (which breaks `jq` / clients). Wrap a route
// body in `jsonRoute()` and throw freely inside; failures become a logged,
// structured 500. Use `ApiError` to control status + code.
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { log } from '@/lib/observability/logger'

export class ApiError extends Error {
  status: number
  code: string
  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export function jsonError(endpoint: string, e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.code, detail: e.message, endpoint }, { status: e.status })
  }
  const detail = e instanceof Error ? e.message : String(e)
  log.error({ event: 'api.unhandled', endpoint, detail, stack: e instanceof Error ? e.stack?.slice(0, 600) : undefined })
  return NextResponse.json({ error: 'internal_error', detail, endpoint }, { status: 500 })
}

/**
 * Wrap a route handler so ANY thrown error returns structured JSON (logged).
 * `handler` receives the Request and must resolve to a NextResponse.
 */
export function jsonRoute(endpoint: string, handler: (req: Request) => Promise<NextResponse>) {
  return async (req: Request): Promise<NextResponse> => {
    const started = Date.now()
    try {
      const res = await handler(req)
      log.info({ event: 'api.ok', endpoint, status: res.status, ms: Date.now() - started })
      return res
    } catch (e) {
      return jsonError(endpoint, e)
    }
  }
}
