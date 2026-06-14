// ─────────────────────────────────────────────────────────────────
// POST /api/trustseal/webhooks/razorpay  (asq-trustseal-billing-b2)
// Razorpay subscription webhook sink. Verifies the signature over the RAW body,
// dedupes by event id, applies the pure state machine, persists, and audits.
//
// Security:
//   • raw-body HMAC verification (req.text() BEFORE JSON.parse)
//   • timingSafeEqual signature check (in verifyRazorpaySignature)
//   • invalid signature → 401 (no state change); missing secret → 503
//   • fail-closed: a processing error → 500 (Razorpay retries; the event row stays
//     processed=false so the retry re-runs), never a silent success
//   • unsupported events → ACK 200 with NO mutation
//   • replayed (already-processed) events → ACK 200 no-op
//
// Writes happen ONLY via lib/billing/writer.ts. No Razorpay API calls here.
// ─────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getStore } from '@/lib/store/adapter'
import { verifyRazorpaySignature, parseRazorpayEvent, auditActionFor } from '@/lib/billing/webhook'
import { persistEventOnce, applyAndUpsert, markProcessed } from '@/lib/billing/writer'
import { audit } from '@/lib/ai/audit'
import { reportError } from '@/lib/observability/errors'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || ''
  if (!secret) return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 })

  // Raw body FIRST — signature is computed over the exact bytes Razorpay signed.
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') || ''
  if (!verifyRazorpaySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let body: unknown
  try { body = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const eventId = req.headers.get('x-razorpay-event-id') || ''
  const event = parseRazorpayEvent(body, eventId)
  if (!event) return NextResponse.json({ ok: true, ignored: true }) // unsupported → ACK, no mutation

  const store = getStore()
  try {
    const digest = createHash('sha256').update(rawBody, 'utf8').digest('hex')
    const { firstSeen } = await persistEventOnce(store, event, digest)
    if (!firstSeen) return NextResponse.json({ ok: true, duplicate: true }) // replay → no-op

    const { applied, previousStatus, nextStatus } = await applyAndUpsert(store, event)
    await markProcessed(store, event.eventId, applied ? `applied:${nextStatus}` : 'noop')

    if (applied && nextStatus !== 'none') {
      const action = auditActionFor(previousStatus, nextStatus)
      if (action) {
        await audit({
          action,
          actor: 'public:razorpay',
          subject: event.uid ?? event.subscriptionId,
          ok: true,
          meta: { eventId: event.eventId, type: event.type, previousStatus, nextStatus },
        })
      }
    }
    return NextResponse.json({ ok: true, applied, status: nextStatus })
  } catch (err) {
    // Fail-closed: surface a 5xx so Razorpay retries; the event row remains
    // processed=false, so the retry re-processes (applyTransition stays idempotent).
    await reportError('webhook.razorpay', err, { severity: 'error' })
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  }
}
