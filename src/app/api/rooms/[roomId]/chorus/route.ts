import { NextRequest, NextResponse } from 'next/server'
import { resolveRoomAccess } from '@/lib/auth/session-guard'
import { listLinkedChorusSessions } from '@/lib/db/chorus'

export const dynamic = 'force-dynamic'

/** The Chorus sessions linked to this room, for the room control page's Chorus card.
 * Controller-gated: a linked session's room controllers can run it, so the list is theirs alone. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const access = await resolveRoomAccess(roomId, req.nextUrl.searchParams.get('token'))
  if (access === 'none') return NextResponse.json({ error: 'room not found' }, { status: 404 })
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  return NextResponse.json(await listLinkedChorusSessions(roomId))
}
