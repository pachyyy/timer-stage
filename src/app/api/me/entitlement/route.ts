import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getEntitlement } from '@/lib/entitlements/client'
import { getOrCreateAccountQuota } from '@/lib/db/quota'

export const dynamic = 'force-dynamic'

/**
 * The signed-in user's own quota status — powers the badge and balance line on /my-rooms. Not
 * gated by ENTITLEMENTS_ENFORCED: showing a balance is harmless with the kill switch off, and
 * it's useful to see it resolving correctly before flipping enforcement on for real.
 *
 * `isPermanent` is the only thing still resolved via pachy-core (see gate.ts) — everyone else's
 * "plan" is really just their quota balance, not a plan row.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  }

  const entitlement = await getEntitlement(session.user.email)
  const isPermanent = entitlement.planKey === 'permanent'
  const quota = isPermanent ? null : await getOrCreateAccountQuota(session.user.id)

  return NextResponse.json({ isPermanent, roomQuota: quota?.roomQuota ?? null, userQuota: quota?.userQuota ?? null })
}
