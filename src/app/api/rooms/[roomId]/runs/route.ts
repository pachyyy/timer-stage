import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { resolveRoomAccess } from '@/lib/auth/session-guard'
import { db } from '@/lib/db/client'
import { rooms } from '@/lib/db/schema'
import { listRuns } from '@/lib/db/run-log'
import { canViewHistory } from '@/lib/entitlements/gate'

export const dynamic = 'force-dynamic'

/** Lists a room's past (and current, if one is open) runs, newest first. Controller-only — a
 * run's event log can include speaker/notes-adjacent detail not meant for the open viewer link. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const token = req.nextUrl.searchParams.get('token')

  const access = await resolveRoomAccess(roomId, token)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Gated on the room OWNER's plan (see canViewHistory) — same room, same plan, regardless of
  // which controller credential is asking.
  const [room] = await db.select({ ownerUserId: rooms.ownerUserId }).from(rooms).where(eq(rooms.id, roomId)).limit(1)
  const gate = await canViewHistory(room?.ownerUserId ?? null)
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason ?? 'History not included on this plan' }, { status: 402 })
  }

  const runs = await listRuns(roomId)
  return NextResponse.json(runs)
}
