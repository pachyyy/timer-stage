import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { db } from './client'
import { chorusQnaQuestions, chorusQnaVotes, chorusState } from './schema'
import { generateId } from '@/lib/auth/tokens'
import type { QnaFeedPayload, QnaQuestionRow } from '@/lib/chorus/types'

/**
 * Q&A mode's audience questions and votes. Like chorus-state.ts's counters, every change here bumps
 * `feedVersion` (the feed's ETag) and NEVER `version`, except hiding the question on screen, which
 * also clears the highlight and so has to reach every client past its version guard.
 */

/** Generous: a long session in a big room, still bounded so the feed stays one cheap response. */
const MAX_QUESTIONS_RETURNED = 500

async function bumpFeed(code: string): Promise<void> {
  await db
    .update(chorusState)
    .set({ feedVersion: sql`${chorusState.feedVersion} + 1` })
    .where(eq(chorusState.sessionId, code))
}

export async function submitQuestion(input: {
  code: string
  text: string
  deviceKey: string
  ipHash: string
  nowMs: number
}): Promise<string> {
  const id = generateId()
  await db.insert(chorusQnaQuestions).values({
    id,
    sessionId: input.code,
    text: input.text,
    createdAtMs: input.nowMs,
    deviceKey: input.deviceKey,
    ipHash: input.ipHash,
  })
  await bumpFeed(input.code)
  return id
}

/**
 * The feed. `includeHidden` is the controller's view; everyone else is never sent a hidden
 * question. `deviceKey` (phones only) adds which questions that device has voted for.
 */
export async function listFeed(
  code: string,
  opts: { includeHidden: boolean; deviceKey: string | null },
): Promise<Omit<QnaFeedPayload, 'feedVersion'>> {
  const voteCount = sql<number>`(select count(*) from ${chorusQnaVotes} where ${chorusQnaVotes.questionId} = ${chorusQnaQuestions.id})`
  const conditions = [eq(chorusQnaQuestions.sessionId, code)]
  if (!opts.includeHidden) conditions.push(isNull(chorusQnaQuestions.hiddenAt))

  const rows = await db
    .select({
      id: chorusQnaQuestions.id,
      text: chorusQnaQuestions.text,
      createdAtMs: chorusQnaQuestions.createdAtMs,
      hiddenAt: chorusQnaQuestions.hiddenAt,
      answeredAt: chorusQnaQuestions.answeredAt,
      votes: voteCount,
    })
    .from(chorusQnaQuestions)
    .where(and(...conditions))
    .orderBy(desc(chorusQnaQuestions.createdAtMs))
    .limit(MAX_QUESTIONS_RETURNED)

  const questions: QnaQuestionRow[] = rows.map((r) => ({
    id: r.id,
    text: r.text,
    createdAtMs: r.createdAtMs,
    votes: Number(r.votes),
    answered: r.answeredAt !== null,
    hidden: r.hiddenAt !== null,
  }))

  let mine: string[] = []
  if (opts.deviceKey) {
    const voted = await db
      .select({ questionId: chorusQnaVotes.questionId })
      .from(chorusQnaVotes)
      .where(and(eq(chorusQnaVotes.sessionId, code), eq(chorusQnaVotes.deviceKey, opts.deviceKey)))
    const visible = new Set(questions.map((q) => q.id))
    mine = voted.map((v) => v.questionId).filter((id) => visible.has(id))
  }
  return { questions, mine }
}

/** The question's row if it belongs to this session, else null. */
export async function getQuestion(code: string, questionId: string) {
  const [row] = await db
    .select()
    .from(chorusQnaQuestions)
    .where(and(eq(chorusQnaQuestions.id, questionId), eq(chorusQnaQuestions.sessionId, code)))
  return row ?? null
}

/**
 * Casts a vote. Idempotent: the (questionId, deviceKey) primary key turns a double tap or a replay
 * into a no-op, so `feedVersion` only moves when a vote was really added.
 */
export async function castVote(input: {
  code: string
  questionId: string
  deviceKey: string
  nowMs: number
}): Promise<boolean> {
  const inserted = await db
    .insert(chorusQnaVotes)
    .values({
      questionId: input.questionId,
      sessionId: input.code,
      deviceKey: input.deviceKey,
      createdAtMs: input.nowMs,
    })
    .onConflictDoNothing()
    .returning({ questionId: chorusQnaVotes.questionId })
  if (inserted.length === 0) return false
  await bumpFeed(input.code)
  return true
}

/** Removes a vote; idempotent like castVote. */
export async function removeVote(input: { code: string; questionId: string; deviceKey: string }): Promise<boolean> {
  const removed = await db
    .delete(chorusQnaVotes)
    .where(and(eq(chorusQnaVotes.questionId, input.questionId), eq(chorusQnaVotes.deviceKey, input.deviceKey)))
    .returning({ questionId: chorusQnaVotes.questionId })
  if (removed.length === 0) return false
  await bumpFeed(input.code)
  return true
}

/**
 * The host's moderation: hide/unhide and mark answered. Returns whether the on-screen highlight was
 * cleared (hiding the highlighted question), in which case `version` was bumped in the same
 * statement and the caller must publish the new state.
 */
export async function setQuestionFlags(input: {
  code: string
  questionId: string
  hidden?: boolean
  answered?: boolean
  nowMs: number
}): Promise<{ highlightCleared: boolean }> {
  const set: Partial<typeof chorusQnaQuestions.$inferInsert> = {}
  if (input.hidden !== undefined) set.hiddenAt = input.hidden ? input.nowMs : null
  if (input.answered !== undefined) set.answeredAt = input.answered ? input.nowMs : null
  if (Object.keys(set).length > 0) {
    await db
      .update(chorusQnaQuestions)
      .set(set)
      .where(and(eq(chorusQnaQuestions.id, input.questionId), eq(chorusQnaQuestions.sessionId, input.code)))
  }
  await bumpFeed(input.code)

  let highlightCleared = false
  if (input.hidden) {
    const cleared = await db
      .update(chorusState)
      .set({ currentQuestionId: null, version: sql`${chorusState.version} + 1`, updatedAt: input.nowMs })
      .where(and(eq(chorusState.sessionId, input.code), eq(chorusState.currentQuestionId, input.questionId)))
      .returning({ sessionId: chorusState.sessionId })
    highlightCleared = cleared.length > 0
  }
  return { highlightCleared }
}

/** What checkAnswerRateLimit needs for a typed question, off the questions table's own indexes. */
export async function readQnaRateInputs(code: string, deviceKey: string, ipHash: string, windowStartMs: number) {
  const [lastDevice] = await db
    .select({ at: chorusQnaQuestions.createdAtMs })
    .from(chorusQnaQuestions)
    .where(and(eq(chorusQnaQuestions.sessionId, code), eq(chorusQnaQuestions.deviceKey, deviceKey)))
    .orderBy(desc(chorusQnaQuestions.createdAtMs))
    .limit(1)
  const [ipCount] = await db
    .select({ n: count() })
    .from(chorusQnaQuestions)
    .where(
      and(
        eq(chorusQnaQuestions.sessionId, code),
        eq(chorusQnaQuestions.ipHash, ipHash),
        gte(chorusQnaQuestions.createdAtMs, windowStartMs),
      ),
    )
  return { lastDeviceAnswerAtMs: lastDevice?.at ?? null, ipAnswersInWindow: ipCount?.n ?? 0 }
}

/** This device's votes in the last window, for checkVoteRateLimit. */
export async function countRecentVotes(code: string, deviceKey: string, windowStartMs: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(chorusQnaVotes)
    .where(
      and(
        eq(chorusQnaVotes.sessionId, code),
        eq(chorusQnaVotes.deviceKey, deviceKey),
        gte(chorusQnaVotes.createdAtMs, windowStartMs),
      ),
    )
  return row?.n ?? 0
}
