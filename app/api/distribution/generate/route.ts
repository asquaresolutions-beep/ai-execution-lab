// POST /api/distribution/generate
// Body: ScamInput (+ optional { locales, enqueue: Channel[] })
// Generates a full ContentBundle. Admin-gated (AI cost).
import { NextResponse } from 'next/server'
import { generateBundle } from '@/lib/distribution/engine'
import { enqueue } from '@/lib/distribution/queue'
import type { Channel } from '@/lib/distribution/integrations'
import type { ScamInput, Locale } from '@/lib/distribution/types'
import { requireAdmin } from '@/lib/admin-auth'
import { RateLimitError } from '@/lib/ai/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const auth = requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: ScamInput & { locales?: Locale[]; enqueue?: Channel[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  if (!body?.title || !body?.description || !body?.platform || !body?.region || !body?.severity) {
    return NextResponse.json({ error: 'title, description, platform, region, severity are required' }, { status: 400 })
  }

  try {
    const bundle = await generateBundle(body, { locales: body.locales })
    let jobs
    if (body.enqueue?.length) {
      jobs = await enqueue(bundle.id, { channels: body.enqueue })
    }
    return NextResponse.json({ bundle, jobs }, { status: 201 })
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 })
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
