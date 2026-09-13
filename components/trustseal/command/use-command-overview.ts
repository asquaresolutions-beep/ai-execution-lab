'use client'
// components/trustseal/command/use-command-overview.ts
// Loads the signed-in account's Command Center data from the gated
// GET /api/trustseal/command/overview (Bearer token from the shared auth session).
// Read-only. Keeps the last good data visible while a refresh (e.g. after a token
// refresh) is in flight; never substitutes sample data on failure.
import { useCallback, useEffect, useState } from 'react'
import type { CommandOverview } from '@/lib/trustseal/command/types'

export type OverviewState =
  | { status: 'loading'; data: CommandOverview | null }
  | { status: 'ready'; data: CommandOverview }
  | { status: 'error'; data: CommandOverview | null; httpStatus: number | null }

export function useCommandOverview(idToken: string | undefined) {
  const [state, setState] = useState<OverviewState>({ status: 'loading', data: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!idToken) return
    const ac = new AbortController()
    setState((s) => ({ status: 'loading', data: s.data }))
    void (async () => {
      let httpStatus: number | null = null
      try {
        const r = await fetch('/api/trustseal/command/overview', {
          headers: { Authorization: `Bearer ${idToken}` }, cache: 'no-store', signal: ac.signal,
        })
        httpStatus = r.status
        if (!r.ok) throw new Error(`overview ${r.status}`)
        const data = (await r.json()) as CommandOverview
        if (!ac.signal.aborted) setState({ status: 'ready', data })
      } catch {
        if (!ac.signal.aborted) setState((s) => ({ status: 'error', data: s.data, httpStatus }))
      }
    })()
    return () => ac.abort()
  }, [idToken, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, reload }
}
