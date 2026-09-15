import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listOwnedRuns } from '@/lib/db/history'

export const dynamic = 'force-dynamic'

/** Every run across every room the signed-in user owns, newest first — powers the cross-room
 * /history page. Account-scoped, like /api/me/rooms — no room-code param at all. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'sign in required' }, { status: 401 })

  const runs = await listOwnedRuns(session.user.id)
  return NextResponse.json(runs)
}
