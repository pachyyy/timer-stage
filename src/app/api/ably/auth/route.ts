import * as Ably from 'ably'
import { NextRequest, NextResponse } from 'next/server'
import { resolveRoomAccess } from '@/lib/auth/session-guard'
import { checkChorusAccess } from '@/lib/auth/chorus-guard'
import { CHORUS_CHANNEL, ROOM_CHANNEL } from '@/lib/sync/transport'

export const dynamic = 'force-dynamic'

/**
 * Issues a short-lived Ably token request scoped to `room:{roomId}`, with capability determined
 * by the room token: controllers get publish+subscribe (needed for presence/future features;
 * actual state writes still go through the validated /actions route, not a direct Ably publish),
 * viewers get subscribe-only. The real Ably API key never reaches the browser.
 *
 * `kind=chorus` scopes to `chorus:{code}` instead, subscribe-only for everyone: no Chorus screen
 * ever needs to publish, and its public state is open to anyone with the code (answers never go
 * over this channel — see src/lib/db/chorus-state.ts's bumpAnswersVersion).
 */
export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId')
  const token = req.nextUrl.searchParams.get('token')
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const isChorus = req.nextUrl.searchParams.get('kind') === 'chorus'

  let capability: Record<string, Ably.CapabilityOp[]>
  if (isChorus) {
    const access = await checkChorusAccess(roomId, null)
    if (access === 'none') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    capability = { [CHORUS_CHANNEL.channelName(roomId)]: ['subscribe'] }
  } else {
    const access = await resolveRoomAccess(roomId, token)
    if (access === 'none') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const ops: Ably.CapabilityOp[] = access === 'controller' ? ['publish', 'subscribe'] : ['subscribe']
    capability = { [ROOM_CHANNEL.channelName(roomId)]: ops }
  }

  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'realtime not configured' }, { status: 503 })

  const client = new Ably.Rest({ key: apiKey })

  // Must match the clientId the Realtime client on the other end connects with (ably-transport.ts)
  // — Ably rejects the connection with 40102 "invalid clientId for credentials" otherwise.
  const tokenRequest = await client.auth.createTokenRequest({ capability, clientId })
  return NextResponse.json(tokenRequest)
}
