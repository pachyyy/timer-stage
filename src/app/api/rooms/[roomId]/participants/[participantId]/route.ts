import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { resolveRoomAccess } from '@/lib/auth/session-guard'
import { db } from '@/lib/db/client'
import { participants } from '@/lib/db/schema'
import { bumpVersion, loadRoomStatePayload } from '@/lib/db/room-state'
import { publishRoomState } from '@/lib/sync/publish'

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

  if ((await resolveRoomAccess(roomId, body?.token)) !== 'controller') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  await db.delete(participants).where(and(eq(participants.id, participantId), eq(participants.roomId, roomId)))

  // Nothing in the broadcast payload changes, but bumping the version is what tells every open
  // screen in the room to re-check its own role now (useParticipant / useOwnRole refetch
  // /participants/me on each version change instead of polling it), so the affected person sees
  // the change within one sync tick.
  await bumpVersion(roomId)
  const payload = await loadRoomStatePayload(roomId)
  if (payload) await publishRoomState(roomId, payload)

  return NextResponse.json({ ok: true })
}
