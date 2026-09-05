import { eq, asc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { checkRoomAccess } from '@/lib/auth/guard'
import { db } from '@/lib/db/client'
import { timers } from '@/lib/db/schema'
import { generateId } from '@/lib/auth/tokens'
import { loadRoomStatePayload } from '@/lib/db/room-state'
import { publishRoomState } from '@/lib/sync/publish'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const rows = await db.select().from(timers).where(eq(timers.roomId, roomId)).orderBy(asc(timers.position))
  return NextResponse.json(rows)
}

/** Append a timer to the agenda. Controller-only; re-broadcasts the room snapshot afterward. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const access = await checkRoomAccess(roomId, body.token)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const existing = await db.select().from(timers).where(eq(timers.roomId, roomId))
  const id = generateId()

  await db.insert(timers).values({
    id,
    roomId,
    position: existing.length,
    name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled',
    speaker: body.speaker ?? null,
    notes: body.notes ?? null,
    type: 'countdown',
    durationMs: Number.isFinite(body.durationMs) ? body.durationMs : 5 * 60_000,
    wrapUpMs: Number.isFinite(body.wrapUpMs) ? body.wrapUpMs : 60_000,
  })

  const payload = await loadRoomStatePayload(roomId)
  if (payload) await publishRoomState(roomId, payload)

  return NextResponse.json({ id }, { status: 201 })
}
