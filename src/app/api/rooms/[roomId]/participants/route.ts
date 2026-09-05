import { eq, asc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { checkRoomAccess } from '@/lib/auth/guard'
import { generateId, generateToken } from '@/lib/auth/tokens'
import { db } from '@/lib/db/client'
import { participants, rooms } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

/**
 * Join a room as a named participant. No auth required beyond the room existing — viewing is
 * meant to work by room code alone (see checkRoomAccess). Every viewer, whether they arrived via
 * a direct link or the "join with code" flow, goes through this same endpoint once, then caches
 * the returned session in localStorage (see src/lib/auth/participant.ts) so it isn't repeated.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 60) : ''
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId))
  if (!room) return NextResponse.json({ error: 'room not found' }, { status: 404 })

  const participantId = generateId()
  const sessionToken = generateToken()

  await db.insert(participants).values({
    id: participantId,
    roomId,
    name,
    sessionToken,
    role: 'viewer',
    joinedAt: Date.now(),
  })

  return NextResponse.json({ participantId, sessionToken, name, role: 'viewer' }, { status: 201 })
}

/** Admin-only list of everyone who has joined, for the controller's participants panel. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const token = req.nextUrl.searchParams.get('token')
  if ((await checkRoomAccess(roomId, token)) !== 'controller') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const rows = await db
    .select({
      id: participants.id,
      name: participants.name,
      role: participants.role,
      joinedAt: participants.joinedAt,
    })
    .from(participants)
    .where(eq(participants.roomId, roomId))
    .orderBy(asc(participants.joinedAt))

  return NextResponse.json(rows)
}
