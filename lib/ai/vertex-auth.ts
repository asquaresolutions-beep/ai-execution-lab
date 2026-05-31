// ─────────────────────────────────────────────────────────────────
// lib/ai/vertex-auth.ts
// Vertex AI authentication — dependency-free.
//
// Two supported modes (checked in order):
//   1. VERTEX_ACCESS_TOKEN            — a pre-minted OAuth token (simplest;
//                                       e.g. injected by Workload Identity).
//   2. GOOGLE_SERVICE_ACCOUNT_JSON    — a service-account key; we mint a
//      (or GCP_SERVICE_ACCOUNT_KEY)     short-lived access token by signing
//                                       a JWT (RS256) with node:crypto and
//                                       exchanging it at the Google token
//                                       endpoint. Tokens are cached ~55 min.
//
// No google-auth-library needed.
// ─────────────────────────────────────────────────────────────────

import { createSign } from 'node:crypto'

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id?: string
  token_uri?: string
}

interface CachedToken {
  token: string
  expiresAt: number
}

let _cache: CachedToken | null = null
let _sa: ServiceAccount | null | undefined

const SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

function loadServiceAccount(): ServiceAccount | null {
  if (_sa !== undefined) return _sa
  const raw =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GCP_SERVICE_ACCOUNT_KEY ||
    ''
  if (!raw) return (_sa = null)
  try {
    // Accept raw JSON or base64-encoded JSON (handy for env vars).
    const json = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8')
    const parsed = JSON.parse(json) as ServiceAccount
    if (!parsed.client_email || !parsed.private_key) return (_sa = null)
    // Support escaped newlines in the private key.
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
    return (_sa = parsed)
  } catch {
    return (_sa = null)
  }
}

/** True when Vertex auth can produce a token (token or service account present). */
export function hasVertexAuth(): boolean {
  return !!process.env.VERTEX_ACCESS_TOKEN || !!loadServiceAccount()
}

export function serviceAccountProjectId(): string {
  return loadServiceAccount()?.project_id || ''
}

/** Returns a valid bearer access token, minting + caching as needed. */
export async function getAccessToken(): Promise<string> {
  const direct = process.env.VERTEX_ACCESS_TOKEN
  if (direct) return direct

  const now = Date.now()
  if (_cache && _cache.expiresAt > now + 60_000) return _cache.token

  const sa = loadServiceAccount()
  if (!sa) throw new Error('No Vertex credentials: set VERTEX_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON')

  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token'
  const iat = Math.floor(now / 1000)
  const exp = iat + 3600
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: SCOPE,
    aud: tokenUri,
    iat,
    exp,
  }))
  const signingInput = `${header}.${claim}`
  const signature = createSign('RSA-SHA256').update(signingInput).sign(sa.private_key)
  const jwt = `${signingInput}.${b64urlBuf(signature)}`

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    throw new Error(`Vertex token exchange failed ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in: number }
  _cache = { token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) * 1000 }
  return _cache.token
}

/** Test/override hook. */
export function resetVertexAuthCache(): void {
  _cache = null
  _sa = undefined
}

function b64url(s: string): string {
  return Buffer.from(s).toString('base64url')
}
function b64urlBuf(b: Buffer): string {
  return b.toString('base64url')
}
