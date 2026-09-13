'use client'

// Client auth context shared by ScamCheck and TrustSeal. Google login via Google
// Identity Services' rendered button (see components/auth/auth-button.tsx and
// lib/auth/google-signin.ts); the Google ID token is exchanged for a Firebase
// session through the Identity Toolkit REST API (no firebase SDK). Session is
// persisted in localStorage. Degrades gracefully when auth env isn't set.
//
// Email/password sign-in is intentionally NOT exposed: that provider is disabled
// in Firebase, so offering it only produced a guaranteed error.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authConfigured, signInWithGoogleIdToken, refreshSession, type AuthUser } from '@/lib/auth/firebase'
import { exchangeGoogleCredential } from '@/lib/auth/google-signin'
import { trackEvent } from '@/lib/track-event'

interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  configured: boolean
  /** Google client id for the rendered sign-in button ('' when not configured). */
  googleClientId: string
  /** Exchange a Google ID token for a session. Always settles: resolves on success, throws GoogleSignInError otherwise. */
  signInWithGoogleCredential: (credential: string | undefined) => Promise<void>
  signOut: () => void
}
const Ctx = createContext<AuthCtx | null>(null)
const STORAGE_KEY = 'sc_auth_v1'
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setUser(JSON.parse(raw)) } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const persist = useCallback((u: AuthUser | null) => {
    setUser(u)
    try { u ? localStorage.setItem(STORAGE_KEY, JSON.stringify(u)) : localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  // Keep the Firebase ID token fresh. Tokens expire after ~1h; a stale token is
  // rejected server-side and silently downgrades a logged-in user to the guest
  // limit (3/day). Refresh on mount if expired, then just before each expiry.
  useEffect(() => {
    if (!user?.refreshToken) return
    let cancelled = false
    const doRefresh = async (u: AuthUser) => {
      try { const fresh = await refreshSession(u.refreshToken); if (!cancelled) persist({ ...u, ...fresh }) }
      catch { if (!cancelled) persist(null) } // refresh token revoked → sign out
    }
    const msUntil = (user.expiresAt || 0) - Date.now()
    if (msUntil <= 0) { void doRefresh(user); return () => { cancelled = true } }
    const t = setTimeout(() => void doRefresh(user), Math.min(msUntil, 50 * 60_000))
    return () => { cancelled = true; clearTimeout(t) }
  }, [user, persist])

  const doGoogleCredential = useCallback(async (credential: string | undefined) => {
    persist(await exchangeGoogleCredential(credential, signInWithGoogleIdToken))
    trackEvent('login', { method: 'google' })
  }, [persist])

  const value = useMemo<AuthCtx>(() => ({
    user, loading, configured: authConfigured(), googleClientId: GOOGLE_CLIENT_ID,
    signInWithGoogleCredential: doGoogleCredential, signOut: () => persist(null),
  }), [user, loading, doGoogleCredential, persist])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}
