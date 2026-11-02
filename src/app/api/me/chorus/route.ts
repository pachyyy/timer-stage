import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listOwnedChorusSessions } from '@/lib/db/chorus'

export const dynamic = 'force-dynamic'

/** Every Chorus session the signed-in user owns, newest first — /my-rooms, the dashboard's Running
 * tab (filtered to live ones client-side), and the room card's "Link existing" picker. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'sign in required' }, { status: 401 })

  return NextResponse.json(await listOwnedChorusSessions(session.user.id))
}
