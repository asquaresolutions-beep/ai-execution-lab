'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { type Ledger, type ScanType, rollover, remaining as remainingFn, spend, quotaFor, nextResetISO } from '@/lib/credits/credits'

const key = (uid: string) => `sc_credits_${uid}`

/** Auth-aware daily credit ledger (client soft limit; server enforcement TBD). */
export function useCredits() {
  const { user } = useAuth()
  const uid = user?.uid || 'guest'
  const loggedIn = !!user
  const [ledger, setLedger] = useState<Ledger>(() => rollover(null))

  useEffect(() => {
    let stored: Ledger | null = null
    try { const raw = localStorage.getItem(key(uid)); if (raw) stored = JSON.parse(raw) } catch { /* ignore */ }
    const l = rollover(stored)
    setLedger(l)
    try { localStorage.setItem(key(uid), JSON.stringify(l)) } catch { /* ignore */ }
  }, [uid])

  const trySpend = useCallback((type: ScanType): boolean => {
    const { ledger: next, ok } = spend(ledger, type, loggedIn)
    if (ok) { setLedger(next); try { localStorage.setItem(key(uid), JSON.stringify(next)) } catch { /* ignore */ } }
    return ok
  }, [ledger, loggedIn, uid])

  return {
    remaining: remainingFn(ledger, loggedIn),
    quota: quotaFor(loggedIn),
    loggedIn,
    resetsAt: nextResetISO(),
    trySpend,
  }
}
