/**
 * Chorus wire types. `ChorusStatePayload` is the PUBLIC, broadcast/poll snapshot every screen —
 * phones included — receives: it carries only the question currently on screen, never the full
 * list, so an audience member can't read ahead. Controller-only routes return `ChorusControlPayload`,
 * which adds the full question list; the control page keeps the two in separate state (see
 * useChorusControl) since the version guard only ever applies to `state`.
 */

export type ChorusStatus = 'draft' | 'live' | 'ended'

export interface ChorusQuestionRef {
  id: string
  position: number
  prompt: string
}

export interface ChorusStatePayload {
  /** Same contract as RoomStatePayload.version: clients MUST discard version <= current. */
  version: number
  code: string
  name: string
  ownerUserId: string | null
  linkedRoomId: string | null
  status: ChorusStatus
  currentQuestion: ChorusQuestionRef | null
  /** 0-based index of `currentQuestion` among all questions, or -1 when there is none. */
  currentIndex: number
  questionCount: number
  answerFontPercent: number
  updatedAtMs: number
}

export interface ChorusControlPayload {
  state: ChorusStatePayload
  questions: ChorusQuestionRef[]
  /** For the presenter-window link and button. Controller-only, like the share card that shows it. */
  presenterToken: string
}

export interface ChorusAnswerRow {
  id: string
  questionId: string
  text: string
  createdAtMs: number
  hidden: boolean
}

export interface ChorusAnswersPayload {
  answersVersion: number
  /** Newest first. The presenter only ever receives visible ones. */
  answers: ChorusAnswerRow[]
  /** Answers per question id (hidden included). Controller only; empty for the presenter. */
  counts: Record<string, number>
}

/** One row of the account-level session lists (/my-rooms, the dashboard's Running tab, the room
 * card's "Link existing" picker). */
export interface ChorusSessionSummary {
  code: string
  name: string
  status: ChorusStatus
  linkedRoomId: string | null
  questionCount: number
  createdAt: number
}
