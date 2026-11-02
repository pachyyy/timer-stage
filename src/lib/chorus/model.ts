import type { ChorusStatus } from './types'

/**
 * Pure Chorus presentation logic, shared by the actions route (which applies it against the
 * server's own clock, same rule as src/lib/timer/model.ts) and the UI (which uses the same
 * predicates to enable/disable buttons). 'ended' is terminal: one credit pays for one
 * presentation, so nothing but the presenter's font size can change after End.
 */

export const MAX_QUESTIONS = 100
export const MAX_PROMPT_LENGTH = 300
export const MAX_ANSWER_LENGTH = 280
export const MAX_NAME_LENGTH = 200

export const FONT_MIN_PERCENT = 60
export const FONT_MAX_PERCENT = 200
export const FONT_STEP_PERCENT = 10

export interface PresentationState {
  status: ChorusStatus
  currentQuestionId: string | null
  answerFontPercent: number
}

export type ChorusAction =
  | { action: 'present' }
  | { action: 'next' }
  | { action: 'prev' }
  | { action: 'goto'; questionId: string }
  | { action: 'end' }
  | { action: 'font'; deltaPercent: number }

export type ChorusActionError = 'not_draft' | 'not_live' | 'no_questions' | 'unknown_question' | 'unknown_action'

export type ActionResult =
  | {
      ok: true
      next: PresentationState
      /** Set only by the transition that caused it, so the route can stamp the server's nowMs. */
      presented?: true
      ended?: true
    }
  | { ok: false; error: ChorusActionError }

export function clampFontPercent(value: number): number {
  if (!Number.isFinite(value)) return 100
  return Math.min(FONT_MAX_PERCENT, Math.max(FONT_MIN_PERCENT, Math.round(value)))
}

/** `questionIds` must already be in position order. */
export function applyChorusAction(
  current: PresentationState,
  input: ChorusAction,
  questionIds: string[],
): ActionResult {
  switch (input.action) {
    case 'present': {
      if (current.status !== 'draft') return { ok: false, error: 'not_draft' }
      if (questionIds.length === 0) return { ok: false, error: 'no_questions' }
      return { ok: true, presented: true, next: { ...current, status: 'live', currentQuestionId: questionIds[0] } }
    }
    case 'next':
    case 'prev': {
      if (current.status !== 'live') return { ok: false, error: 'not_live' }
      const step = input.action === 'next' ? 1 : -1
      return { ok: true, next: { ...current, currentQuestionId: stepQuestion(questionIds, current.currentQuestionId, step) } }
    }
    case 'goto': {
      if (current.status !== 'live') return { ok: false, error: 'not_live' }
      if (!questionIds.includes(input.questionId)) return { ok: false, error: 'unknown_question' }
      return { ok: true, next: { ...current, currentQuestionId: input.questionId } }
    }
    case 'end': {
      if (current.status !== 'live') return { ok: false, error: 'not_live' }
      return { ok: true, ended: true, next: { ...current, status: 'ended' } }
    }
    case 'font':
      return {
        ok: true,
        next: { ...current, answerFontPercent: clampFontPercent(current.answerFontPercent + input.deltaPercent) },
      }
    default:
      return { ok: false, error: 'unknown_action' }
  }
}

/**
 * Moves one question forward or back, stopping at either end rather than wrapping — a presenter
 * mashing Next on the last question shouldn't jump back to the first in front of everyone. A
 * current id that no longer exists (deleted mid-show, see afterDelete) restarts from the first.
 */
export function stepQuestion(questionIds: string[], currentId: string | null, step: 1 | -1): string | null {
  if (questionIds.length === 0) return null
  const index = currentId ? questionIds.indexOf(currentId) : -1
  if (index === -1) return questionIds[0]
  const nextIndex = Math.min(questionIds.length - 1, Math.max(0, index + step))
  return questionIds[nextIndex]
}

/**
 * Where the live question goes when the host deletes the one currently on screen: the question
 * that took its place (the next one), or the new last one when it was the last. `questionIds` is
 * the order BEFORE the delete.
 */
export function afterDelete(questionIds: string[], currentId: string | null, deletedId: string): string | null {
  if (currentId !== deletedId) return currentId
  const index = questionIds.indexOf(deletedId)
  const remaining = questionIds.filter((id) => id !== deletedId)
  if (remaining.length === 0) return null
  return remaining[Math.min(index, remaining.length - 1)]
}

/** Trims an answer; null when it's empty or over the cap (the input enforces the cap too, so a
 * longer one is a hand-crafted request — reject it rather than silently truncating). */
export function normalizeAnswer(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text || text.length > MAX_ANSWER_LENGTH) return null
  return text
}

/** Trims a question prompt, capping its length; null when empty. */
export function normalizePrompt(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.trim().slice(0, MAX_PROMPT_LENGTH)
  return text || null
}

/**
 * The join box's routing rule: an all-digit 6-character code is a Chorus session, anything else is
 * a timer room (room codes always contain a letter — see generateRoomId). Returns null for input
 * that can't be either.
 */
export function classifyJoinCode(raw: string): { kind: 'chorus' | 'room'; code: string } | null {
  const code = raw.trim().replace(/\s+/g, '').toUpperCase()
  if (!code) return null
  if (/^\d{6}$/.test(code)) return { kind: 'chorus', code }
  return { kind: 'room', code }
}

/** "482 913" — how a code is shown on the presenter screen, so it reads at a glance. */
export function formatChorusCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code
}
