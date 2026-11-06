import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { resolveRoomAccess } from '@/lib/auth/session-guard'
import { db } from '@/lib/db/client'
import { participants } from '@/lib/db/schema'
import { bumpVersion, loadRoomStatePayload } from '@/lib/db/room-state'
import { publishRoomState } from '@/lib/sync/publish'

export const dynamic = 'force-dynamic'

/**
 * Promote or demote a participant. Controller-only. Demoting is what makes promotion safe to
 * grant liberally — see checkRoomAccess, which re-checks this role on every mutating request, so
 * a demoted participant loses control immediately on their next action attempt (and their own
 * client picks it up proactively via the /participants/me poll).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string; participantId: string }> },
) {
  const { roomId, participantId } = await params
  const body = await req.json().catch(() => null)
  if (!body || (body.role !== 'viewer' && body.role !== 'controller')) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if ((await resolveRoomAccess(roomId, body.token)) !== 'controller') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  await db
    .update(participants)
    .set({ role: body.role })
    .where(and(eq(participants.id, participantId), eq(participants.roomId, roomId)))

  // Nothing in the broadcast payload changes, but bumping the version is what tells every open
  // screen in the room to re-check its own role now (useParticipant / useOwnRole refetch
  // /participants/me on each version change instead of polling it), so the affected person sees
  // the change within one sync tick.
  await bumpVersion(roomId)
  const payload = await loadRoomStatePayload(roomId)
  if (payload) await publishRoomState(roomId, payload)

  return NextResponse.json({ ok: true })
}
