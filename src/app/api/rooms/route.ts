import { NextRequest, NextResponse } from 'next/server'
import { createRoom } from '@/lib/db/seed-helpers'
import { auth } from '@/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled event'
  const timerInputs = Array.isArray(body.timers) ? body.timers : []

  // Anonymous creation is untouched: signed out, `session` is null, `ownerUserId` is null, and
  // the room behaves exactly as it always has. Signed in, the room is additionally linked to the
  // account for cross-device control and the "My Rooms" history view.
  const session = await auth()

  const { roomId, controllerToken, viewerToken } = await createRoom({
    name,
    timers: timerInputs,
    ownerUserId: session?.user?.id ?? null,
  })

  return NextResponse.json({ roomId, controllerToken, viewerToken })
}
