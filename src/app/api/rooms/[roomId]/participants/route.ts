import { and, asc, count, eq, gte } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { resolveRoomAccess } from '@/lib/auth/session-guard'
import { generateId, generateToken } from '@/lib/auth/tokens'
import { db } from '@/lib/db/client'
import { participants, rooms } from '@/lib/db/schema'
import { canJoinParticipant } from '@/lib/entitlements/gate'
import { hashClientIp } from '@/lib/rate-limit/client-ip'
import { checkJoinRateLimit, JOIN_WINDOW_MS } from '@/lib/rate-limit/join'

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

  // Before the gate below, which may spend one of the host's participant credits — a script
  // flooding joins must hit this wall without draining anyone's balance.
  const nowMs = Date.now()
  const ipHash = hashClientIp(req, roomId)
  const [{ n: recentJoins }] = await db
    .select({ n: count() })
    .from(participants)
    .where(
      and(
        eq(participants.roomId, roomId),
        eq(participants.ipHash, ipHash),
        gte(participants.joinedAt, nowMs - JOIN_WINDOW_MS),
      ),
    )
  const limit = checkJoinRateLimit(recentJoins)
  if (!limit.ok) {
    const t = await getTranslations('gate')
    const seconds = Math.ceil(limit.retryAfterMs / 1000)
    return NextResponse.json(
      { error: t('tooManyJoins'), retryAfterMs: limit.retryAfterMs },
      { status: 429, headers: { 'Retry-After': String(seconds) } },
    )
  }

  // Gated by the ROOM's plan (its owner's), not the joining person's — a viewer never has a plan
  // of their own here.
  const gate = await canJoinParticipant(roomId, room.ownerUserId)
  if (!gate.allowed) {
    const t = await getTranslations('gate')
    return NextResponse.json({ error: gate.reason ?? t('limitReached') }, { status: 402 })
  }

  const participantId = generateId()
  const sessionToken = generateToken()

  await db.insert(participants).values({
    id: participantId,
    roomId,
    name,
    sessionToken,
    role: 'viewer',
    joinedAt: nowMs,
    ipHash,
  })

  return NextResponse.json({ participantId, sessionToken, name, role: 'viewer' }, { status: 201 })
}

/** Admin-only list of everyone who has joined, for the controller's participants panel. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const token = req.nextUrl.searchParams.get('token')
  if ((await resolveRoomAccess(roomId, token)) !== 'controller') {
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
