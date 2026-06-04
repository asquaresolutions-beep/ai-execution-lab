// ─────────────────────────────────────────────────────────────────
// lib/auth/firebase.ts
// Firebase Authentication via the Identity Toolkit REST API — no firebase SDK
// dependency (keeps the repo dependency-light). Email/password + Google (the
// Google ID token is obtained client-side via Google Identity Services and
// exchanged here for a Firebase session). Uses NEXT_PUBLIC_FIREBASE_API_KEY.
// ─────────────────────────────────────────────────────────────────

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''
const IDP = 'https://identitytoolkit.googleapis.com/v1/accounts'
const SECURE_TOKEN = 'https://securetoken.googleapis.com/v1/token'

// expiresAt: epoch ms when the idToken expires. Firebase ID tokens last 1 hour;
// we store the expiry so the client can refresh before the server rejects a
// stale token (which would otherwise downgrade a logged-in user to guest limits).
export interface AuthUser { uid: string; email: string; name: string; idToken: string; refreshToken: string; expiresAt: number }
export function authConfigured(): boolean { return !!API_KEY }

function expiryFrom(expiresIn?: string | number): number {
  const secs = Number(expiresIn) || 3600
  // Refresh 5 min early to avoid edge-of-expiry rejections.
  return Date.now() + Math.max(60, secs - 300) * 1000
}

interface IdpResponse { localId: string; email?: string; displayName?: string; idToken: string; refreshToken: string; fullName?: string; expiresIn?: string }

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
  return { uid: d.localId, email: d.email || '', name: d.displayName || d.fullName || (d.email || '').split('@')[0], idToken: d.idToken, refreshToken: d.refreshToken, expiresAt: expiryFrom(d.expiresIn) }
}

/**
 * Exchange a refresh token for a fresh ID token (Secure Token API). Returns the
 * token fields to merge into the stored user. Throws if the refresh token is
 * invalid/revoked so the caller can sign the user out.
 */
export async function refreshSession(refreshToken: string): Promise<Pick<AuthUser, 'idToken' | 'refreshToken' | 'expiresAt'>> {
  if (!API_KEY) throw new Error('Auth not configured.')
  const res = await fetch(`${SECURE_TOKEN}?key=${API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.id_token) throw new Error((data?.error?.message || 'TOKEN_REFRESH_FAILED').toString())
  return { idToken: data.id_token as string, refreshToken: (data.refresh_token as string) || refreshToken, expiresAt: expiryFrom(data.expires_in) }
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
