// ─────────────────────────────────────────────────────────────────
// lib/auth/verify-token.ts
// Server-side Firebase ID token verification — dependency-free (node:crypto).
// Firebase ID tokens are RS256 JWTs signed by Google's securetoken service.
// We verify the signature against Google's public x509 certs (cached), and
// validate aud/iss/exp/sub against the Firebase project. No firebase-admin SDK.
// ─────────────────────────────────────────────────────────────────

import { createVerify } from 'node:crypto'

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
function projectId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ''
}

let _certs: { map: Record<string, string>; exp: number } | null = null
async function getCerts(): Promise<Record<string, string> | null> {
  if (_certs && _certs.exp > Date.now()) return _certs.map
  try {
    const res = await fetch(CERT_URL)
    if (!res.ok) return null
    const map = (await res.json()) as Record<string, string>
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600)
    _certs = { map, exp: Date.now() + maxAge * 1000 }
    return map
  } catch { return null }
}

function decodeJson(part: string): Record<string, unknown> | null {
  try { return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) } catch { return null }
}

export interface VerifiedUser { uid: string; email: string }

/** Verify a Firebase ID token. Returns the user or null (never throws). */
export async function verifyFirebaseIdToken(token: string): Promise<VerifiedUser | null> {
  const pid = projectId()
  if (!token || !pid) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const header = decodeJson(parts[0]) as { alg?: string; kid?: string } | null
  const payload = decodeJson(parts[1]) as { aud?: string; iss?: string; exp?: number; sub?: string; email?: string } | null
  if (!header || !payload || header.alg !== 'RS256' || !header.kid) return null

  const certs = await getCerts()
  const cert = certs?.[header.kid]
  if (!cert) return null

  const ok = createVerify('RSA-SHA256').update(`${parts[0]}.${parts[1]}`).verify(cert, Buffer.from(parts[2], 'base64url'))
  if (!ok) return null

  const now = Math.floor(Date.now() / 1000)
  if (!payload.sub || !payload.exp || payload.exp < now) return null
  if (payload.aud !== pid) return null
  if (payload.iss !== `https://securetoken.google.com/${pid}`) return null
  return { uid: payload.sub, email: payload.email || '' }
}
