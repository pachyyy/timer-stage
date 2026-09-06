import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { checkRoomAccess } from '@/lib/auth/guard'
import { db } from '@/lib/db/client'
import { participants } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

/**
 * Remove a participant entirely — as opposed to demoting them (role/route.ts), which only strips
 * controller access and leaves them listed as a viewer. Controller-only.
 *
 * Deleting the row is what /participants/me's 404 then picks up as "you were removed" rather than
 * a transient error on the removed person's own client — see useParticipant (viewer page) and
 * useOwnRole (control page), which both poll that endpoint and react once it stops finding them.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; participantId: string }> },
) {
  const { roomId, participantId } = await params
  const body = await req.json().catch(() => null)

  if ((await checkRoomAccess(roomId, body?.token)) !== 'controller') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  await db.delete(participants).where(and(eq(participants.id, participantId), eq(participants.roomId, roomId)))

  return NextResponse.json({ ok: true })
}
