import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { resolveChorusAccess, resolveRoomAccess } from '@/lib/auth/session-guard'
import { db } from '@/lib/db/client'
import { chorusSessions } from '@/lib/db/schema'
import { bumpPublishRespond } from '@/lib/chorus/server'

export const dynamic = 'force-dynamic'

/**
 * Links a session to a timer room, so it shows as a card on that room's control page and the
 * room's controllers can run it (see checkChorusAccess). Needs control of BOTH: the session (via
 * `token`, or ownership) and the room (via `roomToken`, or ownership) — otherwise anyone holding a
 * room could annex someone else's session, or vice versa.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json().catch(() => null)
  const roomId = typeof body?.roomId === 'string' ? body.roomId : ''
  if (!roomId) return NextResponse.json({ error: 'roomId is required' }, { status: 400 })

  const [chorusAccess, roomAccess] = await Promise.all([
    resolveChorusAccess(code, body.token ?? null),
    resolveRoomAccess(roomId, body.roomToken ?? null),
  ])
  if (chorusAccess === 'none' || roomAccess === 'none') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (chorusAccess !== 'controller' || roomAccess !== 'controller') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  await db.update(chorusSessions).set({ linkedRoomId: roomId, updatedAt: Date.now() }).where(eq(chorusSessions.id, code))
  return bumpPublishRespond(code)
}

/** Unlinks. Either side's controller may do it — `token` here can be the session's own or the
 * linked room's, both of which checkChorusAccess already resolves to 'controller'. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const access = await resolveChorusAccess(code, req.nextUrl.searchParams.get('token'))
  if (access === 'none') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  await db.update(chorusSessions).set({ linkedRoomId: null, updatedAt: Date.now() }).where(eq(chorusSessions.id, code))
  return bumpPublishRespond(code)
}
