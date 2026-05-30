// ─────────────────────────────────────────────────────────────────
// lib/cron-auth.ts
// Authenticates Vercel cron invocations. Vercel sends
//   Authorization: Bearer <CRON_SECRET>
// on scheduled requests. We also accept the same secret for manual
// triggering. Rejects everything else.
// ─────────────────────────────────────────────────────────────────

import { env } from '@/lib/env'

export function isAuthorizedCron(req: Request): boolean {
  if (!env.cronSecret) return false
  const header = req.headers.get('authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  // Vercel also sets this header on cron requests in some configs.
  const vercelHeader = req.headers.get('x-vercel-cron')
  return token === env.cronSecret || (!!vercelHeader && token === env.cronSecret)
}
