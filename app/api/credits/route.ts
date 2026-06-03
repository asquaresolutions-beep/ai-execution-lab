// GET /api/credits  (PUBLIC) — authoritative credit state for the caller.
// Verified Firebase user (Bearer ID token) → 50/day; otherwise guest by IP → 3/day.
import { NextResponse } from 'next/server'
import { resolveSubject } from '@/lib/api/identify'
import { getCreditState } from '@/lib/credits/server-credits'
import { jsonRoute } from '@/lib/api/json'

export const dynamic = 'force-dynamic'

export const GET = jsonRoute('credits', async (req) => {
  const id = await resolveSubject(req)
  const state = await getCreditState(id.subject, id.loggedIn)
  return NextResponse.json({ ...state, email: id.email ?? null }, { headers: { 'Cache-Control': 'no-store' } })
})
