import { NextRequest, NextResponse } from 'next/server'
import { resolveRoomAccess } from '@/lib/auth/session-guard'
import { listRuns } from '@/lib/db/run-log'

export const dynamic = 'force-dynamic'

/** Lists a room's past (and current, if one is open) runs, newest first. Controller-only — a
 * run's event log can include speaker/notes-adjacent detail not meant for the open viewer link. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const token = req.nextUrl.searchParams.get('token')

  const access = await resolveRoomAccess(roomId, token)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const runs = await listRuns(roomId)
  return NextResponse.json(runs)
}
