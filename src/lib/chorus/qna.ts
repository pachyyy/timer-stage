import { MAX_ASKED_LENGTH } from './model'
import type { QnaQuestionRow } from './types'

/**
 * Pure Q&A helpers, shared by the routes and every screen that shows the audience's questions so
 * the controller, the phones and the results view can never rank them differently.
 */

/** Trims a question typed by the audience; null when empty or over the cap (the input enforces the
 * cap too, so a longer one is a hand-crafted request — reject it rather than truncating). */
export function normalizeAsked(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text || text.length > MAX_ASKED_LENGTH) return null
  return text
}

/** Most votes first, then the newest question, then id so the order is fully deterministic. */
export function rankQuestions<T extends Pick<QnaQuestionRow, 'id' | 'votes' | 'createdAtMs'>>(items: T[]): T[] {
  return [...items].sort((a, b) => b.votes - a.votes || b.createdAtMs - a.createdAtMs || a.id.localeCompare(b.id))
}

/** Newest first — the phones' "Recent" tab. */
export function sortRecent<T extends Pick<QnaQuestionRow, 'id' | 'createdAtMs'>>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAtMs - a.createdAtMs || a.id.localeCompare(b.id))
}

/** Splits a controller's feed into the three groups it shows: open (ranked), answered, hidden. */
export function groupQuestions(items: QnaQuestionRow[]): {
  open: QnaQuestionRow[]
  answered: QnaQuestionRow[]
  hidden: QnaQuestionRow[]
} {
  const hidden = items.filter((q) => q.hidden)
  const visible = items.filter((q) => !q.hidden)
  return {
    open: rankQuestions(visible.filter((q) => !q.answered)),
    answered: rankQuestions(visible.filter((q) => q.answered)),
    hidden: rankQuestions(hidden),
  }
}
