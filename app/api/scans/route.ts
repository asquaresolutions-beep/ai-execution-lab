// GET /api/scans  (AUTH) — the signed-in user's scan history + stats for the dashboard.
import { NextResponse } from 'next/server'
import { resolveSubject } from '@/lib/api/identify'
import { getHistory } from '@/lib/scamcheck/scan-history'
import { getCreditState } from '@/lib/credits/server-credits'
import { jsonRoute } from '@/lib/api/json'

export const dynamic = 'force-dynamic'

export const GET = jsonRoute('scans', async (req) => {
  const id = await resolveSubject(req)
  if (!id.loggedIn || !id.uid) return NextResponse.json({ error: 'unauthorized', detail: 'Sign in to view your scan history.' }, { status: 401 })
  const [history, credits] = await Promise.all([getHistory(id.uid), getCreditState(id.subject, true)])
  return NextResponse.json({ ...history, credits, email: id.email ?? null }, { headers: { 'Cache-Control': 'no-store' } })
})
