// lib/api/identify.ts
// Resolve the credit subject for a request: a verified Firebase user (uid) when
// a valid Bearer ID token is present, otherwise a guest keyed by client IP.
import { verifyFirebaseIdToken } from '@/lib/auth/verify-token'
import { clientIp } from '@/lib/admin-auth'

export interface Subject { subject: string; loggedIn: boolean; uid?: string; email?: string }

export async function resolveSubject(req: Request): Promise<Subject> {
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '')
  if (m) {
    const u = await verifyFirebaseIdToken(m[1].trim())
    if (u) return { subject: `uid:${u.uid}`, loggedIn: true, uid: u.uid, email: u.email }
  }
  return { subject: `ip:${clientIp(req)}`, loggedIn: false }
}
