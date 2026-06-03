'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import type { AuthUser } from '@/lib/auth/firebase'

/** Authorization header for authenticated API calls (server verifies the token). */
export function authHeaders(user: AuthUser | null): Record<string, string> {
  return user?.idToken ? { Authorization: `Bearer ${user.idToken}` } : {}
}

export interface CreditView { remaining: number; quota: number; used: number; loggedIn: boolean; resetsAt: string }

/**
 * Server-backed credit view. The server (/api/credits + scan endpoints) is the
 * source of truth; this hook only reflects it (no client-side spending). Call
 * refresh() after a scan to update the display.
 */
export function useCredits() {
  const { user } = useAuth()
  const [state, setState] = useState<CreditView>({ remaining: 3, quota: 3, used: 0, loggedIn: false, resetsAt: '' })

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/credits', { headers: authHeaders(user), cache: 'no-store' })
      if (r.ok) { const d = await r.json(); setState({ remaining: d.remaining, quota: d.quota, used: d.used, loggedIn: d.loggedIn, resetsAt: d.resetsAt }) }
    } catch { /* keep last known */ }
  }, [user])

  useEffect(() => { void refresh() }, [refresh])

  return { ...state, refresh }
}
