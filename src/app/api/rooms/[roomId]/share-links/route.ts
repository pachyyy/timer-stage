import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { checkRoomAccess } from '@/lib/auth/guard'
import { db } from '@/lib/db/client'
import { rooms } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

/**
 * Controller-only lookup of the viewer token, so the controller UI can render/copy the viewer
 * share link. Deliberately NOT part of the room-state broadcast payload — that goes out over
 * the realtime channel and to anyone holding either token, so it must never carry the other
 * token.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const token = req.nextUrl.searchParams.get('token')

  const access = await checkRoomAccess(roomId, token)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId))
  if (!room) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({ viewerToken: room.viewerToken })
}
