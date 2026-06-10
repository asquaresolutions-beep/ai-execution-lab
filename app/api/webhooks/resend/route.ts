// POST /api/webhooks/resend  (asq-resend-analytics-v1)
// Ingests Resend delivery/engagement events (delivered, bounced, opened, clicked,
// complained) into `email_events`. Svix-signed; rejects unverified payloads.
// Requires env RESEND_WEBHOOK_SECRET (whsec_…). Read-only side effects = append-only
// event records; no subscriber mutation here.
import { NextResponse } from 'next/server'
import { verifyResendSignature, parseResendEvent } from '@/lib/email/webhook'
import { recordEmailEvent } from '@/lib/email/events'
import { reportError } from '@/lib/observability/errors'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET || ''
  if (!secret) return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 })

  const rawBody = await req.text()
  const ok = verifyResendSignature({
    secret,
    svixId: req.headers.get('svix-id') || '',
    svixTimestamp: req.headers.get('svix-timestamp') || '',
    svixSignature: req.headers.get('svix-signature') || '',
    rawBody,
  })
  if (!ok) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })

  let body: unknown
  try { body = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const evt = parseResendEvent(body)
  if (!evt) return NextResponse.json({ ok: true, ignored: true }) // unsupported type → ack, don't retry

  try {
    await recordEmailEvent(evt)
  } catch (err) {
    await reportError('webhook.resend', err, { severity: 'warning' })
  }
  return NextResponse.json({ ok: true, type: evt.type })
}
