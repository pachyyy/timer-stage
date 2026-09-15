import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

/** Updates the signed-in user's own display name. Database sessions (see auth.ts) mean the next
 * `auth()` call already reads the fresh row — no separate session-invalidation step needed. */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'sign in required' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (name.length > 100) return NextResponse.json({ error: 'Name is too long' }, { status: 400 })

  await db.update(users).set({ name }).where(eq(users.id, session.user.id))
  return NextResponse.json({ name })
}
