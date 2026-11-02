import { createHash } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { resolveChorusAccess } from '@/lib/auth/session-guard'
import { bumpChorusVersion, getPresentationRow, loadChorusControlPayload } from '@/lib/db/chorus-state'
import { publishChorusState } from '@/lib/sync/publish'
import type { ChorusControlPayload } from './types'

/**
 * Server-only helpers shared by the /api/chorus routes. The tail of every controller mutation is
 * the same three steps as the room routes' — bump the version, broadcast the public state, return
 * the full payload so the actor's own screen applies it instantly — so it lives here once.
 */
export async function bumpPublishRespond(
  code: string,
  options: { currentQuestionId?: string | null; status?: number } = {},
): Promise<NextResponse> {
  await bumpChorusVersion(code, options.currentQuestionId)
  return publishRespond(code, options.status)
}

export async function publishRespond(code: string, status = 200): Promise<NextResponse> {
  const payload = await loadChorusControlPayload(code)
  if (!payload) return NextResponse.json({ error: 'session not found' }, { status: 404 })
  await publishChorusState(code, payload.state)
  return NextResponse.json(payload satisfies ChorusControlPayload, { status })
}

/**
 * The client's network identity for rate limiting, hashed with the session code so the stored
 * value can't be joined across sessions or reversed into an IP. Vercel puts the real client IP
 * first in x-forwarded-for.
 */
export function hashClientIp(req: NextRequest, code: string): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || req.headers.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(`${ip}:${code}`).digest('hex').slice(0, 32)
}

/** Controller-only, and the session must not have ended (an ended session is read-only — its
 * answers are the record of that one presentation). Returns an error response, or null when the
 * caller may proceed. */
export async function guardEditable(code: string, token: string | null): Promise<NextResponse | null> {
  const access = await resolveChorusAccess(code, token)
  if (access === 'none') return NextResponse.json({ error: 'session not found' }, { status: 404 })
  if (access !== 'controller') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const row = await getPresentationRow(code)
  if (!row) return NextResponse.json({ error: 'session not found' }, { status: 404 })
  if (row.status === 'ended') {
    const t = await getTranslations('chorusApi')
    return NextResponse.json({ error: t('ended') }, { status: 409 })
  }
  return null
}
