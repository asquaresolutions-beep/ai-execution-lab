// ─────────────────────────────────────────────────────────────────
// lib/ai/vertex-auth.ts
// Vertex AI authentication — dependency-free.
//
// Modes (checked in order):
//   1. VERTEX_ACCESS_TOKEN            — a pre-minted OAuth token.
//   2. GOOGLE_SERVICE_ACCOUNT_JSON    — a service-account key (inline or
//      (or GCP_SERVICE_ACCOUNT_KEY,     base64, or a file path via
//       or GOOGLE_APPLICATION_CREDENTIALS file) → mint a JWT (RS256) and
//                                       exchange for a token.
//   3. Application Default Credentials (ADC) — on Cloud Run / GCE, fetch a
//                                       token from the metadata server using
//                                       the ATTACHED service account. No env
//                                       token or key needed.
// Tokens cached ~55 min. No google-auth-library needed.
// ─────────────────────────────────────────────────────────────────

import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

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
  let raw =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GCP_SERVICE_ACCOUNT_KEY ||
    ''
  // GOOGLE_APPLICATION_CREDENTIALS may point to a service-account key FILE.
  if (!raw && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try { raw = readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8') } catch { /* not a readable SA file */ }
  }
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

/**
 * True when ADC is available — i.e. we're on a GCP runtime (Cloud Run / GCE /
 * Cloud Functions) whose metadata server can mint a token for the attached
 * service account. Detected from runtime env signals (no network call).
 */
export function adcAvailable(): boolean {
  return !!(
    process.env.K_SERVICE ||           // Cloud Run
    process.env.K_REVISION ||          // Cloud Run
    process.env.FUNCTION_TARGET ||     // Cloud Functions
    process.env.GAE_SERVICE ||         // App Engine
    process.env.GCE_METADATA_HOST ||   // explicit metadata host
    process.env.USE_ADC                // explicit opt-in
  )
}

/** True when Vertex auth can produce a token (explicit token, service account, or ADC). */
export function hasVertexAuth(): boolean {
  return !!process.env.VERTEX_ACCESS_TOKEN || !!loadServiceAccount() || adcAvailable()
}

// Last metadata-token failure reason — so an ADC timeout on a GCP runtime is
// reported truthfully instead of being mislabeled "no credentials".
let _lastMetaError: string | null = null
export function lastMetadataError(): string | null { return _lastMetaError }

/**
 * Fetch an access token from the GCP metadata server (ADC / attached SA).
 * Cold Cloud Run instances (min-instances 0) can take >1.5s for the FIRST
 * metadata call, so use a generous timeout and retry — a single short timeout
 * was being misread as "no credentials" even though ADC is available.
 */
async function fetchMetadataToken(retries = 2, timeoutMs = 3500): Promise<CachedToken | null> {
  const host = process.env.GCE_METADATA_HOST || 'metadata.google.internal'
  const url = `http://${host}/computeMetadata/v1/instance/service-accounts/default/token`
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), timeoutMs)
      const res = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' }, signal: ctrl.signal })
      clearTimeout(t)
      if (!res.ok) {
        _lastMetaError = `metadata token HTTP ${res.status}`
      } else {
        const d = (await res.json()) as { access_token?: string; expires_in?: number }
        if (d.access_token) { _lastMetaError = null; return { token: d.access_token, expiresAt: Date.now() + (d.expires_in ?? 3600) * 1000 } }
        _lastMetaError = 'metadata token response had no access_token'
      }
    } catch (e) {
      _lastMetaError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
  }
  return null
}

export function serviceAccountProjectId(): string {
  return loadServiceAccount()?.project_id || ''
}

let _projectId: string | null | undefined

/** Synchronous project id from env / service account (no network). */
export function projectIdFromEnv(): string {
  return (
    process.env.VERTEX_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    serviceAccountProjectId() ||
    ''
  )
}

/** Project id: env first, then the GCP metadata server (ADC). Cached. */
export async function getProjectId(): Promise<string> {
  const fromEnv = projectIdFromEnv()
  if (fromEnv) return fromEnv
  if (_projectId !== undefined) return _projectId || ''
  try {
    const host = process.env.GCE_METADATA_HOST || 'metadata.google.internal'
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3500)
    const res = await fetch(`http://${host}/computeMetadata/v1/project/project-id`, { headers: { 'Metadata-Flavor': 'Google' }, signal: ctrl.signal })
    clearTimeout(t)
    _projectId = res.ok ? (await res.text()).trim() : null
  } catch {
    _projectId = null
  }
  return _projectId || ''
}

/** Returns a valid bearer access token, minting + caching as needed. */
export async function getAccessToken(): Promise<string> {
  const direct = process.env.VERTEX_ACCESS_TOKEN
  if (direct) return direct

  const now = Date.now()
  if (_cache && _cache.expiresAt > now + 60_000) return _cache.token

  const sa = loadServiceAccount()
  if (!sa) {
    // No explicit key → use Application Default Credentials (Cloud Run / GCE
    // attached service account) via the metadata server.
    const adc = await fetchMetadataToken()
    if (adc) { _cache = adc; return adc.token }
    // On a known GCP runtime, a failure here is a metadata/timeout problem,
    // NOT missing credentials — report it truthfully so it isn't misdiagnosed.
    if (adcAvailable()) {
      throw new Error(`ADC token unavailable on GCP runtime (attached service account): ${_lastMetaError ?? 'metadata server did not return a token'}.`)
    }
    throw new Error('No Vertex credentials: set VERTEX_ACCESS_TOKEN / GOOGLE_SERVICE_ACCOUNT_JSON, or run on a GCP runtime with an attached service account (ADC).')
  }

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
  _projectId = undefined
}

function b64url(s: string): string {
  return Buffer.from(s).toString('base64url')
}
function b64urlBuf(b: Buffer): string {
  return b.toString('base64url')
}
