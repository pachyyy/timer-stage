import { NextRequest, NextResponse } from 'next/server'
import { createRoom } from '@/lib/db/seed-helpers'
import { auth } from '@/auth'
import { canAddSegments, canCreateRoom } from '@/lib/entitlements/gate'

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

  // Segment (agenda item) count first, deliberately BEFORE canCreateRoom below: this check has no
  // side effect, but canCreateRoom actually SPENDS a room credit the moment it says yes (see its
  // doc comment) — spending that credit and then rejecting for too many initial segments would
  // charge for a room that was never created. Checking the free (no-cost) thing first avoids that.
  //
  // This also applies to anonymous rooms too, unlike the room-count cap below (they resolve to
  // the flat fallback, same as every other per-room limit an ownerless room needs).
  // `ownerUserId=null` here works identically to a signed-in id: canAddSegments only ever does a
  // `users` lookup, not a `rooms` one, so "the room doesn't exist yet" is a non-issue.
  const segmentGate = await canAddSegments(session?.user?.id ?? null, 0, timerInputs.length)
  if (!segmentGate.allowed) {
    return NextResponse.json({ error: segmentGate.reason ?? 'Plan limit reached' }, { status: 402 })
  }

  // Anonymous creation is never gated on room count — see canCreateRoom's doc comment. For a
  // signed-in, non-"permanent" account this is the point where a room credit is actually spent.
  const roomGate = await canCreateRoom(owner)
  if (!roomGate.allowed) {
    return NextResponse.json({ error: roomGate.reason ?? 'Plan limit reached' }, { status: 402 })
  }

  const { roomId, controllerToken, viewerToken } = await createRoom({
    name,
    timers: timerInputs,
    ownerUserId: session?.user?.id ?? null,
  })

  return NextResponse.json({ roomId, controllerToken, viewerToken })
}
