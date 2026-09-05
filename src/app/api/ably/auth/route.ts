import * as Ably from 'ably'
import { NextRequest, NextResponse } from 'next/server'
import { checkRoomAccess } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

/**
 * Issues a short-lived Ably token request scoped to `room:{roomId}`, with capability determined
 * by the room token: controllers get publish+subscribe (needed for presence/future features;
 * actual state writes still go through the validated /actions route, not a direct Ably publish),
 * viewers get subscribe-only. The real Ably API key never reaches the browser.
 */
export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId')
  const token = req.nextUrl.searchParams.get('token')
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

  const access = await checkRoomAccess(roomId, token)
  if (access === 'none') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'realtime not configured' }, { status: 503 })

  const client = new Ably.Rest({ key: apiKey })
  const ops: Ably.CapabilityOp[] = access === 'controller' ? ['publish', 'subscribe'] : ['subscribe']
  const capability: Record<string, Ably.CapabilityOp[]> = { [`room:${roomId}`]: ops }

  const tokenRequest = await client.auth.createTokenRequest({ capability })
  return NextResponse.json(tokenRequest)
}
