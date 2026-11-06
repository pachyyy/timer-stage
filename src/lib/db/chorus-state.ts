import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db } from './client'
import { chorusQnaQuestions, chorusQuestions, chorusSessions, chorusState } from './schema'
import type { ChorusControlPayload, ChorusMode, ChorusQuestionRef, ChorusStatePayload } from '@/lib/chorus/types'
import type { PresentationState } from '@/lib/chorus/model'

/**
 * The only place that reads/writes `chorus_state` — Chorus's version of room-state.ts, keeping the
 * same invariant enforceable in one place: every client-visible change bumps `version`, every
 * mutating route returns the fresh payload, and every timestamp is the server's own `Date.now()`.
 */

export async function listQuestions(code: string): Promise<ChorusQuestionRef[]> {
  return db
    .select({ id: chorusQuestions.id, position: chorusQuestions.position, prompt: chorusQuestions.prompt })
    .from(chorusQuestions)
    .where(eq(chorusQuestions.sessionId, code))
    .orderBy(asc(chorusQuestions.position))
}

/** 'qna': the ids of the questions the host may highlight — visible ones only. */
export async function listVisibleQnaIds(code: string): Promise<string[]> {
  const rows = await db
    .select({ id: chorusQnaQuestions.id })
    .from(chorusQnaQuestions)
    .where(and(eq(chorusQnaQuestions.sessionId, code), isNull(chorusQnaQuestions.hiddenAt)))
  return rows.map((r) => r.id)
}

/** The highlighted question's text, or null when nothing (visible) is highlighted. */
async function loadHighlight(code: string, questionId: string | null): Promise<{ id: string; text: string } | null> {
  if (!questionId) return null
  const [row] = await db
    .select({ id: chorusQnaQuestions.id, text: chorusQnaQuestions.text })
    .from(chorusQnaQuestions)
    .where(
      and(
        eq(chorusQnaQuestions.id, questionId),
        eq(chorusQnaQuestions.sessionId, code),
        isNull(chorusQnaQuestions.hiddenAt),
      ),
    )
  return row ?? null
}

function toPayload(
  session: typeof chorusSessions.$inferSelect,
  state: typeof chorusState.$inferSelect,
  questions: ChorusQuestionRef[],
  highlight: { id: string; text: string } | null,
): ChorusStatePayload {
  const qna = session.mode === 'qna'
  // In 'qna' mode `currentQuestionId` is the highlighted audience question, not a prompt.
  const currentIndex = !qna && state.currentQuestionId ? questions.findIndex((q) => q.id === state.currentQuestionId) : -1
  return {
    version: state.version,
    code: session.id,
    name: session.name,
    ownerUserId: session.ownerUserId,
    linkedRoomId: session.linkedRoomId,
    mode: session.mode,
    status: state.status,
    intakeOpen: state.intakeOpen,
    highlight: qna ? highlight : null,
    currentQuestion: currentIndex === -1 ? null : questions[currentIndex],
    currentIndex,
    questionCount: questions.length,
    answerFontPercent: state.answerFontPercent,
    updatedAtMs: state.updatedAt,
  }
}

async function loadAll(code: string) {
  const [state] = await db.select().from(chorusState).where(eq(chorusState.sessionId, code))
  if (!state) return null
  const [session] = await db.select().from(chorusSessions).where(eq(chorusSessions.id, code))
  if (!session) return null
  const questions = session.mode === 'qna' ? [] : await listQuestions(code)
  const highlight = session.mode === 'qna' ? await loadHighlight(code, state.currentQuestionId) : null
  return { session, state, questions, highlight }
}

/** The public snapshot — what the poll endpoint serves and what's broadcast. */
export async function loadChorusStatePayload(code: string): Promise<ChorusStatePayload | null> {
  const all = await loadAll(code)
  return all ? toPayload(all.session, all.state, all.questions, all.highlight) : null
}

/** The controller-only snapshot: the public state plus the full question list. */
export async function loadChorusControlPayload(code: string): Promise<ChorusControlPayload | null> {
  const all = await loadAll(code)
  return all
    ? {
        state: toPayload(all.session, all.state, all.questions, all.highlight),
        questions: all.questions,
        presenterToken: all.session.presenterToken,
      }
    : null
}

/**
 * Applies a presentation transition: reads the current row and question order, lets `mutate`
 * (normally src/lib/chorus/model.ts's applyChorusAction) compute the next state, then writes it
 * with a bumped version. `mutate` returning null means "rejected, write nothing"; the caller maps
 * that to its own error response. Stamps presentedAtMs / endedAtMs with the server clock.
 */
export async function mutateChorusState<E>(
  code: string,
  mutate: (
    current: PresentationState,
    questionIds: string[],
    mode: ChorusMode,
  ) => { next: PresentationState; presented?: boolean; ended?: boolean } | { error: E },
): Promise<{ payload: ChorusControlPayload } | { error: E } | null> {
  const nowMs = Date.now()
  const [current] = await db.select().from(chorusState).where(eq(chorusState.sessionId, code))
  if (!current) return null
  const [session] = await db.select({ mode: chorusSessions.mode }).from(chorusSessions).where(eq(chorusSessions.id, code))
  if (!session) return null
  const ids = session.mode === 'qna' ? await listVisibleQnaIds(code) : (await listQuestions(code)).map((q) => q.id)

  const result = mutate(
    {
      status: current.status,
      currentQuestionId: current.currentQuestionId,
      answerFontPercent: current.answerFontPercent,
      intakeOpen: current.intakeOpen,
    },
    ids,
    session.mode,
  )
  if ('error' in result) return { error: result.error }

  await db
    .update(chorusState)
    .set({
      version: current.version + 1,
      status: result.next.status,
      currentQuestionId: result.next.currentQuestionId,
      answerFontPercent: result.next.answerFontPercent,
      intakeOpen: result.next.intakeOpen,
      ...(result.presented ? { presentedAtMs: nowMs } : {}),
      ...(result.ended ? { endedAtMs: nowMs } : {}),
      updatedAt: nowMs,
    })
    .where(eq(chorusState.sessionId, code))

  const payload = await loadChorusControlPayload(code)
  return payload ? { payload } : null
}

/**
 * Same role as room-state.ts's bumpVersion: for changes that don't go through mutateChorusState
 * (question edits, rename, link/unlink) but still have to reach every already-synced client past
 * its version guard. Optionally moves the current question in the same atomic statement — a
 * delete of the question on screen has to swap it for another without a second, separately-lost
 * write.
 */
export async function bumpChorusVersion(code: string, currentQuestionId?: string | null): Promise<void> {
  await db
    .update(chorusState)
    .set({
      version: sql`${chorusState.version} + 1`,
      ...(currentQuestionId !== undefined ? { currentQuestionId } : {}),
      updatedAt: Date.now(),
    })
    .where(eq(chorusState.sessionId, code))
}

/** Bumped on every new or hidden/unhidden answer — the answers feed's ETag. Deliberately leaves
 * `version` alone, so the audience's phones never refetch because of someone else's answer. */
export async function bumpAnswersVersion(code: string): Promise<void> {
  await db
    .update(chorusState)
    .set({ answersVersion: sql`${chorusState.answersVersion} + 1` })
    .where(eq(chorusState.sessionId, code))
}

export async function getAnswersVersion(code: string): Promise<number | null> {
  const [row] = await db
    .select({ answersVersion: chorusState.answersVersion })
    .from(chorusState)
    .where(eq(chorusState.sessionId, code))
  return row?.answersVersion ?? null
}

export async function getPresentationRow(code: string) {
  const [row] = await db.select().from(chorusState).where(eq(chorusState.sessionId, code))
  return row ?? null
}

/** Bumped on every new, voted, hidden or answered Q&A question — the feed's ETag. Like
 * `answersVersion`, deliberately leaves `version` alone. */
export async function bumpFeedVersion(code: string): Promise<void> {
  await db
    .update(chorusState)
    .set({ feedVersion: sql`${chorusState.feedVersion} + 1` })
    .where(eq(chorusState.sessionId, code))
}

export async function getFeedVersion(code: string): Promise<number | null> {
  const [row] = await db
    .select({ feedVersion: chorusState.feedVersion })
    .from(chorusState)
    .where(eq(chorusState.sessionId, code))
  return row?.feedVersion ?? null
}
