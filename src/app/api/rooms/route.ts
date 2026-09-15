import { NextRequest, NextResponse } from 'next/server'
import { createRoom } from '@/lib/db/seed-helpers'
import { auth } from '@/auth'
import { isAuthConfigured } from '@/lib/auth/config'
import { canAddSegments, canCreateRoom } from '@/lib/entitlements/gate'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled event'
  const timerInputs = Array.isArray(body.timers) ? body.timers : []

  // Room creation now requires a signed-in account (the /dashboard route is gated the same way,
  // see (app)/layout.tsx) — this is the actual enforcement, the layout redirect is only a
  // convenience. Skipped when auth isn't configured at all (no AUTH_* env vars — local dev keeps
  // working with zero env vars, per CLAUDE.md), same as the (app) layout's own check.
  const session = await auth()
  if (isAuthConfigured() && !session?.user) {
    return NextResponse.json({ error: 'Sign in to create a room.' }, { status: 401 })
  }
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
