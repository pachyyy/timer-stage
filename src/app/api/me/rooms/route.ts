import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listOwnedRooms } from '@/lib/db/my-rooms'

export const dynamic = 'force-dynamic'

/** Every room the signed-in user owns. Account-scoped, not token-scoped — unlike every other
 * route in the app, there is no room-code param here at all. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'sign in required' }, { status: 401 })

  const owned = await listOwnedRooms(session.user.id)
  return NextResponse.json(owned)
}
