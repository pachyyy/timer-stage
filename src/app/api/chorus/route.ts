import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { isAuthConfigured } from '@/lib/auth/config'
import { resolveRoomAccess } from '@/lib/auth/session-guard'
import { canCreateChorus } from '@/lib/entitlements/gate'
import { createChorusSession } from '@/lib/db/chorus'
import { MAX_NAME_LENGTH, MAX_QUESTIONS, normalizePrompt } from '@/lib/chorus/model'
import type { ChorusMode } from '@/lib/chorus/types'

/**
 * Creates a Chorus session (`mode`: 'answers', the default, or 'qna'; one credit either way) — from the dashboard, or from a timer room's control page with
 * `linkRoomId` + `roomToken`, which links it to that room in the same step. Same sign-in rule as
 * POST /api/rooms: a session spends a credit, so there has to be an account to bill (skipped when
 * auth isn't configured at all, so local dev works with zero env vars).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const t = await getTranslations('gate')
  const tc = await getTranslations('chorusApi')

  const name =
    typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, MAX_NAME_LENGTH) : tc('untitled')
  // 'qna' sessions have no prepared prompts: the audience supplies the questions.
  const mode: ChorusMode = body.mode === 'qna' ? 'qna' : 'answers'
  const prompts =
    mode === 'qna'
      ? []
      : (Array.isArray(body.questions) ? body.questions : [])
          .map(normalizePrompt)
          .filter((p: string | null): p is string => p !== null)
  if (prompts.length > MAX_QUESTIONS) {
    return NextResponse.json({ error: tc('tooManyQuestions', { max: MAX_QUESTIONS }) }, { status: 400 })
  }

  const session = await auth()
  if (isAuthConfigured() && !session?.user) {
    return NextResponse.json({ error: tc('signInToCreate') }, { status: 401 })
  }
  const owner =
    session?.user?.id && session.user.email ? { userId: session.user.id, email: session.user.email } : null

  // Checked before the credit is spent, for the same reason POST /api/rooms checks segments first.
  const linkRoomId = typeof body.linkRoomId === 'string' && body.linkRoomId ? body.linkRoomId : null
  if (linkRoomId) {
    const access = await resolveRoomAccess(linkRoomId, typeof body.roomToken === 'string' ? body.roomToken : null)
    if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const gate = await canCreateChorus(owner)
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason ?? t('limitReached') }, { status: 402 })
  }

  const created = await createChorusSession({
    name,
    mode,
    prompts,
    ownerUserId: session?.user?.id ?? null,
    linkedRoomId: linkRoomId,
  })
  return NextResponse.json(created, { status: 201 })
}
