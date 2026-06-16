// ─────────────────────────────────────────────────────────────────
// lib/trustseal/api-key.ts  (asq-trustseal-phase4)
// Storage-light API keys for the public Trust API. A key embeds the accountId and
// is authenticated by an HMAC (TRUSTSEAL_SEAL_SECRET), so verification needs NO
// lookup table: resolveApiKey() verifies the HMAC and returns the accountId, and
// the caller's LIVE plan is resolved from billing at request time (so upgrades /
// downgrades take effect immediately). Keys are deterministic per account (stable,
// no rotation in v1 — rotation/revocation is a roadmap item needing a key store).
// Degrades gracefully when no secret is configured (mint/resolve → null).
// ─────────────────────────────────────────────────────────────────
import { createHmac, timingSafeEqual } from 'node:crypto'

const SECRET = process.env.TRUSTSEAL_SEAL_SECRET || ''
const PREFIX = 'tsk_'

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
const unb64url = (s: string) => Buffer.from(s, 'base64url').toString('utf8')
const sig = (payload: string) => createHmac('sha256', SECRET).update(`apikey|${payload}`).digest('base64url').slice(0, 16)

export function apiKeysConfigured(): boolean { return !!SECRET }

/** Deterministic API key for an account: tsk_<b64(accountId)>_<hmac>. Null if unconfigured. */
export function mintApiKey(accountId: string): string | null {
  if (!SECRET || !accountId) return null
  const payload = b64url(accountId)
  return `${PREFIX}${payload}_${sig(payload)}`
}

/** Verify a key and return its accountId, or null if invalid/unconfigured. */
export function resolveApiKey(key: string | null | undefined): string | null {
  if (!SECRET || !key || !key.startsWith(PREFIX)) return null
  const rest = key.slice(PREFIX.length)
  const i = rest.lastIndexOf('_')
  if (i <= 0) return null
  const payload = rest.slice(0, i)
  const provided = rest.slice(i + 1)
  const expected = sig(payload)
  const a = Buffer.from(provided), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try { return unb64url(payload) || null } catch { return null }
}

/** Extract an API key from a request: `x-api-key` header or `?key=` query. */
export function apiKeyFromRequest(req: Request): string | null {
  const h = req.headers.get('x-api-key')
  if (h) return h.trim()
  try { return new URL(req.url).searchParams.get('key') } catch { return null }
}
