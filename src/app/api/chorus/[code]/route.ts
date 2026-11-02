import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { resolveChorusAccess } from '@/lib/auth/session-guard'
import { db } from '@/lib/db/client'
import { chorusSessions } from '@/lib/db/schema'
import { loadChorusStatePayload } from '@/lib/db/chorus-state'
import { bumpPublishRespond } from '@/lib/chorus/server'
import { MAX_NAME_LENGTH } from '@/lib/chorus/model'

export const dynamic = 'force-dynamic'

/**
 * Public snapshot — the polling target and the realtime resync, same contract as GET
 * /api/rooms/[roomId]. Open to anyone with the code; it carries only the question on screen.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const payload = await loadChorusStatePayload(code)
  if (!payload) return NextResponse.json({ error: 'session not found' }, { status: 404 })

  const etag = `"v${payload.version}"`
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } })
  }
  return NextResponse.json(payload, { headers: { ETag: etag, 'Cache-Control': 'no-store' } })
}

/** Renames the session. Controller-only. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (name.length > MAX_NAME_LENGTH) return NextResponse.json({ error: 'Name is too long' }, { status: 400 })

  const access = await resolveChorusAccess(code, body.token ?? null)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  await db.update(chorusSessions).set({ name, updatedAt: Date.now() }).where(eq(chorusSessions.id, code))
  return bumpPublishRespond(code)
}
