// ─────────────────────────────────────────────────────────────────
// lib/admin-auth.ts
// Minimal admin guard for write/admin API routes. Checks a bearer token
// against ADMIN_API_TOKEN. Returns the admin id when authorised, else null.
// Swap for Firebase Auth custom claims when wiring to real accounts.
// ─────────────────────────────────────────────────────────────────

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || ''

export function requireAdmin(req: Request): { ok: true; adminId: string } | { ok: false } {
  if (!ADMIN_TOKEN) return { ok: false }
  const header = req.headers.get('authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (token && token === ADMIN_TOKEN) return { ok: true, adminId: 'admin' }
  return { ok: false }
}

export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}
