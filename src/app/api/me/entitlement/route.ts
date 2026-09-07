import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getEntitlement } from '@/lib/entitlements/client'

export const dynamic = 'force-dynamic'

/**
 * The signed-in user's own Cue plan — powers the badge on /my-rooms. Not gated by
 * ENTITLEMENTS_ENFORCED: showing "you're on Free" is harmless with the kill switch off, and
 * it's useful to see the resolution working correctly before flipping enforcement on for real.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'sign in required' }, { status: 401 })

  const entitlement = await getEntitlement(session.user.email)
  return NextResponse.json({ planKey: entitlement.planKey, planName: entitlement.planName, limits: entitlement.limits })
}
