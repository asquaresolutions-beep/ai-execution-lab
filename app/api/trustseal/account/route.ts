// GET /api/trustseal/account  (asq-trustseal-pr1)
// Authenticated bootstrap / "me" endpoint for the TrustSeal customer dashboard.
// Verifies the Bearer Firebase ID token, upserts the ts_accounts row, and returns
// the account profile. 401 for guests / invalid tokens. Per-user → never cached.
import { NextResponse } from 'next/server'
import { requireUser, upsertAccount } from '@/lib/trustseal/account'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await requireUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const account = await upsertAccount(user.uid, user.email)
    return NextResponse.json(
      {
        uid: account.id,
        email: account.email,
        displayName: account.displayName ?? null,
        createdAt: account.createdAt,
        lastSeenAt: account.lastSeenAt,
      },
      { status: 200, headers: { 'cache-control': 'private, no-store' } },
    )
  } catch {
    return NextResponse.json({ error: 'account_unavailable' }, { status: 500 })
  }
}
