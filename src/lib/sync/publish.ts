import * as Ably from 'ably'
import type { RoomStatePayload } from './transport'

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

export async function publishRoomState(roomId: string, payload: RoomStatePayload): Promise<void> {
  const client = getRestClient()
  if (!client) return
  const channel = client.channels.get(`room:${roomId}`)
  await channel.publish('state', payload)
}
