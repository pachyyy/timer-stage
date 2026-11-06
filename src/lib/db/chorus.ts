import { and, count, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { db } from './client'
import { chorusAnswers, chorusQnaQuestions, chorusQuestions, chorusSessions, chorusState } from './schema'
import { generateChorusCode, generateId, generateToken } from '@/lib/auth/tokens'
import type { ChorusAnswerRow, ChorusMode, ChorusSessionSummary } from '@/lib/chorus/types'

export interface CreateChorusInput {
  name: string
  /** Defaults to 'answers'. */
  mode?: ChorusMode
  /** The host's prepared prompts. Always empty for a 'qna' session: the audience supplies those. */
  prompts: string[]
  ownerUserId: string | null
  linkedRoomId: string | null
}

/**
 * Creates a session, its questions, and its initial (draft) state row. The 6-digit code space is
 * small enough that a collision is realistic over time, so unlike createRoom this retries the
 * session insert on a primary-key conflict before giving up.
 */
export async function createChorusSession(input: CreateChorusInput) {
  const nowMs = Date.now()
  const controllerToken = generateToken()
  const presenterToken = generateToken()

  let code: string | null = null
  for (let attempt = 0; attempt < 8 && !code; attempt++) {
    const candidate = generateChorusCode()
    try {
      await db.insert(chorusSessions).values({
        id: candidate,
        name: input.name,
        controllerToken,
        presenterToken,
        mode: input.mode ?? 'answers',
        ownerUserId: input.ownerUserId,
        linkedRoomId: input.linkedRoomId,
        createdAt: nowMs,
        updatedAt: nowMs,
      })
      code = candidate
    } catch {
      // Code already taken — roll another.
    }
  }
  if (!code) throw new Error('could not allocate a Chorus code')

  const sessionId = code
  const questionRows = input.prompts.map((prompt, position) => ({
    id: generateId(),
    sessionId,
    position,
    prompt,
    createdAt: nowMs,
  }))
  if (questionRows.length > 0) await db.insert(chorusQuestions).values(questionRows)

  await db.insert(chorusState).values({ sessionId, version: 0, status: 'draft', updatedAt: nowMs })

  return { code: sessionId, controllerToken, presenterToken }
}

export async function getChorusSession(code: string) {
  const [row] = await db.select().from(chorusSessions).where(eq(chorusSessions.id, code))
  return row ?? null
}

const MAX_ANSWERS_RETURNED = 500

/**
 * The answers feed, newest first. `questionId` null means every question (the results view after
 * End). `includeHidden` is the controller's view; the presenter only ever gets visible ones.
 */
export async function listAnswers(
  code: string,
  questionId: string | null,
  includeHidden: boolean,
): Promise<ChorusAnswerRow[]> {
  const conditions = [eq(chorusAnswers.sessionId, code)]
  if (questionId) conditions.push(eq(chorusAnswers.questionId, questionId))
  if (!includeHidden) conditions.push(isNull(chorusAnswers.hiddenAt))

  const rows = await db
    .select({
      id: chorusAnswers.id,
      questionId: chorusAnswers.questionId,
      text: chorusAnswers.text,
      createdAtMs: chorusAnswers.createdAtMs,
      hiddenAt: chorusAnswers.hiddenAt,
    })
    .from(chorusAnswers)
    .where(and(...conditions))
    .orderBy(desc(chorusAnswers.createdAtMs))
    // The results view (all questions) can legitimately be bigger than one live question's wall.
    .limit(questionId ? MAX_ANSWERS_RETURNED : MAX_ANSWERS_RETURNED * 20)

  return rows.map((r) => ({
    id: r.id,
    questionId: r.questionId,
    text: r.text,
    createdAtMs: r.createdAtMs,
    hidden: r.hiddenAt !== null,
  }))
}

export async function countAnswersByQuestion(code: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ questionId: chorusAnswers.questionId, n: count() })
    .from(chorusAnswers)
    .where(eq(chorusAnswers.sessionId, code))
    .groupBy(chorusAnswers.questionId)
  return Object.fromEntries(rows.map((r) => [r.questionId, r.n]))
}

/** What checkAnswerRateLimit needs, read straight off the answers table's own indexes. */
export async function readRateLimitInputs(code: string, deviceKey: string, ipHash: string, windowStartMs: number) {
  const [lastDevice] = await db
    .select({ at: chorusAnswers.createdAtMs })
    .from(chorusAnswers)
    .where(and(eq(chorusAnswers.sessionId, code), eq(chorusAnswers.deviceKey, deviceKey)))
    .orderBy(desc(chorusAnswers.createdAtMs))
    .limit(1)
  const [ipCount] = await db
    .select({ n: count() })
    .from(chorusAnswers)
    .where(
      and(
        eq(chorusAnswers.sessionId, code),
        eq(chorusAnswers.ipHash, ipHash),
        gte(chorusAnswers.createdAtMs, windowStartMs),
      ),
    )
  return { lastDeviceAnswerAtMs: lastDevice?.at ?? null, ipAnswersInWindow: ipCount?.n ?? 0 }
}

async function summarize(rows: (typeof chorusSessions.$inferSelect)[]): Promise<ChorusSessionSummary[]> {
  if (rows.length === 0) return []
  const codes = rows.map((r) => r.id)
  const states = await db
    .select({ sessionId: chorusState.sessionId, status: chorusState.status })
    .from(chorusState)
    .where(inArray(chorusState.sessionId, codes))
  const counts = await db
    .select({ sessionId: chorusQuestions.sessionId, n: count() })
    .from(chorusQuestions)
    .where(inArray(chorusQuestions.sessionId, codes))
    .groupBy(chorusQuestions.sessionId)
  // 'qna' sessions count the audience's questions instead (hidden ones are not counted).
  const qnaCounts = await db
    .select({ sessionId: chorusQnaQuestions.sessionId, n: count() })
    .from(chorusQnaQuestions)
    .where(and(inArray(chorusQnaQuestions.sessionId, codes), isNull(chorusQnaQuestions.hiddenAt)))
    .groupBy(chorusQnaQuestions.sessionId)
  const statusBy = new Map(states.map((s) => [s.sessionId, s.status]))
  const countBy = new Map(counts.map((c) => [c.sessionId, c.n]))
  const qnaCountBy = new Map(qnaCounts.map((c) => [c.sessionId, c.n]))

  return rows.map((r) => ({
    code: r.id,
    name: r.name,
    status: statusBy.get(r.id) ?? 'draft',
    linkedRoomId: r.linkedRoomId,
    mode: r.mode,
    questionCount: (r.mode === 'qna' ? qnaCountBy : countBy).get(r.id) ?? 0,
    createdAt: r.createdAt,
  }))
}

/** Every session a signed-in user owns, newest first — /my-rooms, the Running tab, and the room
 * card's "Link existing" picker. */
export async function listOwnedChorusSessions(userId: string): Promise<ChorusSessionSummary[]> {
  const rows = await db
    .select()
    .from(chorusSessions)
    .where(eq(chorusSessions.ownerUserId, userId))
    .orderBy(desc(chorusSessions.createdAt))
  return summarize(rows)
}

/** Sessions linked to one timer room, oldest first (the order they were added to the show). */
export async function listLinkedChorusSessions(roomId: string): Promise<ChorusSessionSummary[]> {
  const rows = await db
    .select()
    .from(chorusSessions)
    .where(eq(chorusSessions.linkedRoomId, roomId))
    .orderBy(sql`${chorusSessions.createdAt} asc`)
  return summarize(rows)
}
