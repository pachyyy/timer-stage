import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { participants } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

/**
 * A participant's own live status, looked up by their private sessionToken (never by id — an id
 * is sequential-ish and guessable, a sessionToken is a real bearer credential). Polled by the
 * viewer/controller pages so a promotion (or demotion) takes effect without the person having to
 * refresh or re-enter anything.
 *
 * 404 here means "this token isn't a tracked participant" — that's the expected, harmless result
 * for the room's original controllerToken (which lives in a different table entirely and is
 * never revocable through this mechanism), not an error.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const sessionToken = req.nextUrl.searchParams.get('sessionToken')
  if (!sessionToken) return NextResponse.json({ error: 'sessionToken required' }, { status: 400 })

  const [participant] = await db
    .select({ role: participants.role, name: participants.name })
    .from(participants)
    .where(and(eq(participants.roomId, roomId), eq(participants.sessionToken, sessionToken)))

  if (!participant) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(participant)
}
