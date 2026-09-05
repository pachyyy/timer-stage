import { NextRequest, NextResponse } from 'next/server'
import { loadRoomStatePayload } from '@/lib/db/room-state'

export const dynamic = 'force-dynamic'

/**
 * Snapshot endpoint — used by the polling transport and as the authoritative resync fetched on
 * every realtime (re)connect. ETag makes a poll that finds nothing changed nearly free.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const payload = await loadRoomStatePayload(roomId)
  if (!payload) {
    return NextResponse.json({ error: 'room not found' }, { status: 404 })
  }

  const etag = `"v${payload.version}"`
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } })
  }

  return NextResponse.json(payload, { headers: { ETag: etag, 'Cache-Control': 'no-store' } })
}
