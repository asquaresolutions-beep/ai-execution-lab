'use client'

// Client auth context for ScamCheck. Email/password + Google login via the
// Firebase Identity Toolkit REST API (no firebase SDK). Google ID token is
// obtained through Google Identity Services (loaded on demand). Session is
// persisted in localStorage. Degrades gracefully when auth env isn't set.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authConfigured, signInEmail, signUpEmail, signInWithGoogleIdToken, type AuthUser } from '@/lib/auth/firebase'

interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  configured: boolean
  googleReady: boolean
  signInEmail: (email: string, pw: string) => Promise<void>
  signUpEmail: (email: string, pw: string) => Promise<void>
  signInGoogle: () => Promise<void>
  signOut: () => void
}
const Ctx = createContext<AuthCtx | null>(null)
const STORAGE_KEY = 'sc_auth_v1'
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

declare global { interface Window { google?: { accounts?: { id?: { initialize: (o: unknown) => void; prompt: (cb?: unknown) => void } } } } }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [googleReady, setGoogleReady] = useState(false)

  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setUser(JSON.parse(raw)) } catch { /* ignore */ }
    setLoading(false)
    // Lazy-load Google Identity Services if a client id is configured.
    if (GOOGLE_CLIENT_ID && !document.getElementById('gsi-client')) {
      const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true; s.id = 'gsi-client'
      s.onload = () => setGoogleReady(true); document.head.appendChild(s)
    } else if (GOOGLE_CLIENT_ID) setGoogleReady(true)
  }, [])

  const persist = useCallback((u: AuthUser | null) => {
    setUser(u)
    try { u ? localStorage.setItem(STORAGE_KEY, JSON.stringify(u)) : localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  const doEmailIn = useCallback(async (email: string, pw: string) => { persist(await signInEmail(email, pw)) }, [persist])
  const doEmailUp = useCallback(async (email: string, pw: string) => { persist(await signUpEmail(email, pw)) }, [persist])

  const doGoogle = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) throw new Error('Google login not configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID missing).')
    const gid = window.google?.accounts?.id
    if (!gid) throw new Error('Google sign-in is still loading — try again in a moment.')
    const credential = await new Promise<string>((resolve, reject) => {
      gid.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (resp: { credential?: string }) => resp.credential ? resolve(resp.credential) : reject(new Error('No Google credential')) })
      gid.prompt()
    })
    persist(await signInWithGoogleIdToken(credential))
  }, [persist])

  const value = useMemo<AuthCtx>(() => ({
    user, loading, configured: authConfigured(), googleReady,
    signInEmail: doEmailIn, signUpEmail: doEmailUp, signInGoogle: doGoogle, signOut: () => persist(null),
  }), [user, loading, googleReady, doEmailIn, doEmailUp, doGoogle, persist])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}
