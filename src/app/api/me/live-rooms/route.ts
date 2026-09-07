import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listLiveOwnedRooms } from '@/lib/db/my-rooms'

export const dynamic = 'force-dynamic'

/** Every owned room with a show currently in progress — the "Running Event" tab's data source
 * for a signed-in visitor. Account-scoped, like /api/me/rooms. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'sign in required' }, { status: 401 })

  const live = await listLiveOwnedRooms(session.user.id)
  return NextResponse.json(live)
}
