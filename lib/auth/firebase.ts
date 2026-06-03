// ─────────────────────────────────────────────────────────────────
// lib/auth/firebase.ts
// Firebase Authentication via the Identity Toolkit REST API — no firebase SDK
// dependency (keeps the repo dependency-light). Email/password + Google (the
// Google ID token is obtained client-side via Google Identity Services and
// exchanged here for a Firebase session). Uses NEXT_PUBLIC_FIREBASE_API_KEY.
// ─────────────────────────────────────────────────────────────────

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''
const IDP = 'https://identitytoolkit.googleapis.com/v1/accounts'

export interface AuthUser { uid: string; email: string; name: string; idToken: string; refreshToken: string }
export function authConfigured(): boolean { return !!API_KEY }

interface IdpResponse { localId: string; email?: string; displayName?: string; idToken: string; refreshToken: string; fullName?: string }

async function call(path: string, body: Record<string, unknown>): Promise<AuthUser> {
  if (!API_KEY) throw new Error('Auth not configured (NEXT_PUBLIC_FIREBASE_API_KEY missing).')
  const res = await fetch(`${IDP}:${path}?key=${API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) {
    const msg = (data?.error?.message || 'AUTH_FAILED').replace(/_/g, ' ').toLowerCase()
    throw new Error(msg)
  }
  const d = data as IdpResponse
  return { uid: d.localId, email: d.email || '', name: d.displayName || d.fullName || (d.email || '').split('@')[0], idToken: d.idToken, refreshToken: d.refreshToken }
}

export function signUpEmail(email: string, password: string): Promise<AuthUser> {
  return call('signUp', { email, password, returnSecureToken: true })
}
export function signInEmail(email: string, password: string): Promise<AuthUser> {
  return call('signInWithPassword', { email, password, returnSecureToken: true })
}
/** Exchange a Google ID token (from GIS) for a Firebase session. */
export function signInWithGoogleIdToken(googleIdToken: string): Promise<AuthUser> {
  const requestUri = typeof window !== 'undefined' ? window.location.origin : 'https://scamcheck.asquaresolution.com'
  return call('signInWithIdp', { postBody: `id_token=${googleIdToken}&providerId=google.com`, requestUri, returnIdpCredential: true, returnSecureToken: true })
}
