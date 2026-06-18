// ─────────────────────────────────────────────────────────────────
// lib/trustseal/api-key-store.ts  (asq-trustseal-hardening)
// Store-backed API keys with rotation + revocation. Kept SEPARATE from the pure
// api-key.ts (which the strip-types tests import) so this module's @/store value
// import can't break those tests.
//   • ts_api_keys/<key>        → { accountId, createdAt }  (key → account lookup)
//   • ts_api_key_current/<uid> → { key, createdAt }        (account's active key)
// resolveApiKeyAsync() resolves a stored key first, then FALLS BACK to the legacy
// deterministic HMAC key (api-key.ts) so any previously-issued key keeps working
// (no regression). Rotation issues a new random key and invalidates the old one;
// revocation removes the active key entirely.
// ─────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto'
import { getStore } from '@/lib/store/adapter'
import { resolveApiKey as resolveLegacyHmacKey } from '@/lib/trustseal/api-key'

const KEYS = 'ts_api_keys'
const CURRENT = 'ts_api_key_current'

interface KeyDoc { accountId: string; createdAt: number }
interface CurrentDoc { key: string; createdAt: number }

const newKey = () => `tsk_${randomBytes(24).toString('base64url')}`

/** The account's current key — minting + storing one on first request. */
export async function getApiKey(accountId: string): Promise<{ key: string; createdAt: number }> {
  const cur = await getStore().get<CurrentDoc>(CURRENT, accountId)
  if (cur?.data?.key) return { key: cur.data.key, createdAt: cur.data.createdAt }
  return mint(accountId)
}

async function mint(accountId: string): Promise<{ key: string; createdAt: number }> {
  const key = newKey()
  const createdAt = Date.now()
  await getStore().set<KeyDoc>(KEYS, key, { accountId, createdAt })
  await getStore().set<CurrentDoc>(CURRENT, accountId, { key, createdAt })
  return { key, createdAt }
}

/** Rotate: invalidate the current key and issue a new one. */
export async function rotateApiKey(accountId: string): Promise<{ key: string; createdAt: number }> {
  const cur = await getStore().get<CurrentDoc>(CURRENT, accountId)
  if (cur?.data?.key) { try { await getStore().delete(KEYS, cur.data.key) } catch { /* */ } }
  return mint(accountId)
}

/** Revoke: remove the active key (no key resolves until regenerated). */
export async function revokeApiKey(accountId: string): Promise<void> {
  const cur = await getStore().get<CurrentDoc>(CURRENT, accountId)
  if (cur?.data?.key) { try { await getStore().delete(KEYS, cur.data.key) } catch { /* */ } }
  try { await getStore().delete(CURRENT, accountId) } catch { /* */ }
}

/** Resolve a key → accountId: stored key first, else the legacy HMAC key (no regression). */
export async function resolveApiKeyAsync(key: string | null | undefined): Promise<string | null> {
  if (!key) return null
  try {
    const doc = await getStore().get<KeyDoc>(KEYS, key)
    if (doc?.data?.accountId) return doc.data.accountId
  } catch { /* store unavailable → fall back */ }
  return resolveLegacyHmacKey(key)
}
