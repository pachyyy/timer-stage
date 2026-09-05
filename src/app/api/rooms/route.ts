import { NextRequest, NextResponse } from 'next/server'
import { createRoom } from '@/lib/db/seed-helpers'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled event'
  const timerInputs = Array.isArray(body.timers) ? body.timers : []

  const { roomId, controllerToken, viewerToken } = await createRoom({
    name,
    timers: timerInputs,
  })

  return NextResponse.json({ roomId, controllerToken, viewerToken })
}
