import { NextRequest, NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { resolveChorusAccess } from '@/lib/auth/session-guard'
import { mutateChorusState } from '@/lib/db/chorus-state'
import { publishChorusState } from '@/lib/sync/publish'
import { applyChorusAction, type ChorusAction, type ChorusActionError } from '@/lib/chorus/model'

export const dynamic = 'force-dynamic'

type ActionBody = ChorusAction & { token?: string }

/**
 * Every presentation transition — present / next / prev / goto / end / font. The rules themselves
 * live in src/lib/chorus/model.ts's applyChorusAction; this route only authorizes, applies them
 * via mutateChorusState (server clock, version bump), broadcasts, and returns the full payload.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = (await req.json().catch(() => null)) as ActionBody | null
  if (!body || typeof body.action !== 'string') return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const access = await resolveChorusAccess(code, body.token ?? null)
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const input = toAction(body)
  if (!input) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const result = await mutateChorusState<ChorusActionError>(code, (current, questionIds) => {
    const applied = applyChorusAction(current, input, questionIds)
    return applied.ok ? applied : { error: applied.error }
  })
  if (!result) return NextResponse.json({ error: 'session not found' }, { status: 404 })

  if ('error' in result) {
    const t = await getTranslations('chorusApi')
    const message = result.error === 'no_questions' ? t('noQuestions') : t('actionRejected')
    return NextResponse.json({ error: message, code: result.error }, { status: 409 })
  }

  await publishChorusState(code, result.payload.state)
  return NextResponse.json(result.payload)
}

/** Rebuilds a clean action from the body so nothing but known fields ever reaches the model. */
function toAction(body: ActionBody): ChorusAction | null {
  switch (body.action) {
    case 'present':
    case 'next':
    case 'prev':
    case 'end':
      return { action: body.action }
    case 'goto':
      return typeof body.questionId === 'string' ? { action: 'goto', questionId: body.questionId } : null
    case 'font':
      return Number.isFinite(body.deltaPercent) ? { action: 'font', deltaPercent: body.deltaPercent } : null
    default:
      return null
  }
}
