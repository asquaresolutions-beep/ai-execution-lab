// GET/POST /api/newsletter/unsubscribe  (asq-deliverability-p1)
// Unsubscribe target for the List-Unsubscribe header + in-body link.
//   POST (RFC 8058 one-click): mailbox provider posts here → 200 + suppress.
//   GET  (link click): marks suppressed → friendly confirmation page.
// Non-destructive: sets { unsubscribed:true, unsubscribedAt } on the subscriber
// doc — the record is KEPT (no delete). `id` is the deterministic subscriberDocId
// (sha1 of the email) already used as the doc key, so no email appears in the URL.
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store/adapter'

export const dynamic = 'force-dynamic'

// Subscriber collections that may hold the id (newsletter, AI-Lab, scam-alerts).
const COLLECTIONS = ['newsletter', 'lab_subscribers', 'subscribers'] as const

async function suppress(id: string | null): Promise<boolean> {
  if (!id || !/^nl_[a-f0-9]{8,}$/i.test(id)) return false
  const store = getStore()
  const now = new Date().toISOString()
  let any = false
  for (const c of COLLECTIONS) {
    try {
      const doc = await store.get(c, id)        // only touch a doc that exists (no stray creates)
      if (doc) { await store.update(c, id, { unsubscribed: true, unsubscribedAt: now }); any = true }
    } catch { /* ignore per-collection failure */ }
  }
  return any
}

const page = (ok: boolean) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8">
   <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
   <title>Unsubscribe — A Square Solutions</title></head>
   <body style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:64px auto;padding:0 20px;color:#18181b">
   <h1 style="color:#6366f1;font-size:20px;margin:0 0 12px">A Square Solutions</h1>
   <p style="font-size:15px;line-height:1.5">${ok
     ? 'You have been unsubscribed. You won’t receive further emails from this list.'
     : 'We couldn’t process that unsubscribe link. You can reply to any of our emails and we’ll remove you right away.'}</p>
   <p style="font-size:12px;color:#71717a;margin-top:24px">A Square Solutions · <a href="https://asquaresolution.com" style="color:#71717a">asquaresolution.com</a></p>
   </body></html>`

export async function POST(req: Request) {
  const ok = await suppress(new URL(req.url).searchParams.get('id'))
  return NextResponse.json({ ok }, { status: ok ? 200 : 400, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(req: Request) {
  const ok = await suppress(new URL(req.url).searchParams.get('id'))
  return new NextResponse(page(ok), {
    status: ok ? 200 : 400,
    headers: { 'content-type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
