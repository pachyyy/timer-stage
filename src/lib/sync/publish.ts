import * as Ably from 'ably'
import { CHORUS_CHANNEL, ROOM_CHANNEL, type RoomStatePayload } from './transport'
import type { ChorusStatePayload } from '@/lib/chorus/types'

/**
 * Server-side publish after any mutation. Uses the REST client (no persistent connection needed
 * per-request in a serverless function) with the real API key — this file must never be
 * imported from client code.
 */
let restClient: Ably.Rest | null = null

function getRestClient(): Ably.Rest | null {
  const key = process.env.ABLY_API_KEY
  if (!key) return null // not configured yet — callers should treat publish as best-effort
  if (!restClient) restClient = new Ably.Rest({ key })
  return restClient
}

async function publishState(channelName: string, payload: unknown): Promise<void> {
  const client = getRestClient()
  if (!client) return
  await client.channels.get(channelName).publish('state', payload)
}

export async function publishRoomState(roomId: string, payload: RoomStatePayload): Promise<void> {
  await publishState(ROOM_CHANNEL.channelName(roomId), payload)
}

export async function publishChorusState(code: string, payload: ChorusStatePayload): Promise<void> {
  await publishState(CHORUS_CHANNEL.channelName(code), payload)
}
