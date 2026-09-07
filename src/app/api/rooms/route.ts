import { NextRequest, NextResponse } from 'next/server'
import { createRoom } from '@/lib/db/seed-helpers'
import { auth } from '@/auth'
import { canCreateRoom } from '@/lib/entitlements/gate'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled event'
  const timerInputs = Array.isArray(body.timers) ? body.timers : []

  // Anonymous creation is untouched: signed out, `session` is null, `ownerUserId` is null, and
  // the room behaves exactly as it always has. Signed in, the room is additionally linked to the
  // account for cross-device control and the "My Rooms" history view.
  const session = await auth()
  const owner =
    session?.user?.id && session.user.email ? { userId: session.user.id, email: session.user.email } : null

  // Anonymous creation is also never plan-gated — see canCreateRoom's doc comment. This only
  // ever blocks a signed-in account that's already at its plan's active-room cap.
  const gate = await canCreateRoom(owner)
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason ?? 'Plan limit reached' }, { status: 402 })
  }

  const { roomId, controllerToken, viewerToken } = await createRoom({
    name,
    timers: timerInputs,
    ownerUserId: session?.user?.id ?? null,
  })

  return NextResponse.json({ roomId, controllerToken, viewerToken })
}
