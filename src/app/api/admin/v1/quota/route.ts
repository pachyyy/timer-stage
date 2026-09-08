import { NextRequest, NextResponse } from 'next/server'
import { checkAdminApiAuth } from '@/lib/admin-api/auth'
import { getQuotaByEmail, grantQuotaByEmail } from '@/lib/db/quota'

export const dynamic = 'force-dynamic'

/**
 * Cue's first `/api/admin/v1/*` route (see 03_pachy_panel/docs/ARCHITECTURE.md §7) — the panel
 * calls this to read/top up someone's room+participant quota, since balances live here in
 * stagetimer's own DB, not in the shared pachy-core control plane (see schema.ts's
 * accountQuota doc comment for why).
 */
export async function GET(req: NextRequest) {
  const authError = checkAdminApiAuth(req)
  if (authError) return authError

  const email = req.nextUrl.searchParams.get('email')?.trim()
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const balance = await getQuotaByEmail(email)
  if (!balance) {
    return NextResponse.json(
      { error: `${email} hasn't signed into Cue yet — there's no account to check a balance for.` },
      { status: 404 },
    )
  }

  return NextResponse.json(balance)
}

/** Grants credit — deltas must be positive; this endpoint only ever adds. */
export async function POST(req: NextRequest) {
  const authError = checkAdminApiAuth(req)
  if (authError) return authError

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const roomDelta = Number.isFinite(body?.roomDelta) ? Math.trunc(body.roomDelta) : 0
  const userDelta = Number.isFinite(body?.userDelta) ? Math.trunc(body.userDelta) : 0
  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null

  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  if (roomDelta === 0 && userDelta === 0) {
    return NextResponse.json({ error: 'roomDelta and/or userDelta must be non-zero' }, { status: 400 })
  }
  if (roomDelta < 0 || userDelta < 0) {
    return NextResponse.json({ error: 'deltas must be positive — this endpoint only grants credit' }, { status: 400 })
  }

  const result = await grantQuotaByEmail(email, roomDelta, userDelta, note)
  if (!result) {
    return NextResponse.json(
      { error: `${email} hasn't signed into Cue yet — ask them to sign in once, then grant quota.` },
      { status: 404 },
    )
  }

  return NextResponse.json(result)
}
