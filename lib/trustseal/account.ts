// ─────────────────────────────────────────────────────────────────
// lib/trustseal/account.ts  (asq-trustseal-pr1)
// TrustSeal customer-account helpers.
//   requireUser()   — authenticate an API request via Bearer Firebase ID token,
//                     reusing resolveSubject (verifyFirebaseIdToken under the hood).
//   upsertAccount() — create-if-absent + refresh lastSeenAt; createdAt is set once
//                     and PRESERVED across re-logins.
// Persists through the shared store adapter (MemoryStore in dev/tests,
// FirestoreStore in prod) — collection ts_accounts, doc id = Firebase uid.
// No new env vars: reuses the same Firebase/Firestore config as ScamCheck + verify.
// ─────────────────────────────────────────────────────────────────
import { resolveSubject } from '@/lib/api/identify'
import { getStore } from '@/lib/store/adapter'

export const ACCOUNTS = 'ts_accounts'

export interface TrustAccount {
  id: string // = Firebase uid
  email: string
  displayName?: string
  createdAt: number
  lastSeenAt: number
}

export interface AuthedUser { uid: string; email: string }

/** Authenticate a request via Bearer Firebase ID token. Returns null for guests. */
export async function requireUser(req: Request): Promise<AuthedUser | null> {
  const s = await resolveSubject(req)
  if (!s.loggedIn || !s.uid) return null
  return { uid: s.uid, email: s.email || '' }
}

/**
 * Create-if-absent, otherwise refresh lastSeenAt (+ email/displayName). createdAt
 * is written only on first creation and preserved on subsequent calls.
 */
export async function upsertAccount(uid: string, email: string, displayName?: string): Promise<TrustAccount> {
  const store = getStore()
  const now = Date.now()
  const existing = await store.get<TrustAccount>(ACCOUNTS, uid)

  if (existing) {
    const patch: Partial<TrustAccount> = { lastSeenAt: now }
    if (email) patch.email = email
    if (displayName) patch.displayName = displayName
    await store.update<TrustAccount>(ACCOUNTS, uid, patch)
    return { ...existing.data, ...patch }
  }

  const account: TrustAccount = {
    id: uid,
    email,
    ...(displayName ? { displayName } : {}),
    createdAt: now,
    lastSeenAt: now,
  }
  await store.set<TrustAccount>(ACCOUNTS, uid, account)
  return account
}

/** Read the latest persisted account row, or null if none. */
export async function getAccount(uid: string): Promise<TrustAccount | null> {
  const doc = await getStore().get<TrustAccount>(ACCOUNTS, uid)
  return doc ? doc.data : null
}
