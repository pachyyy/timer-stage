/**
 * Chorus wire types. `ChorusStatePayload` is the PUBLIC, broadcast/poll snapshot every screen —
 * phones included — receives: it carries only the question currently on screen, never the full
 * list, so an audience member can't read ahead. Controller-only routes return `ChorusControlPayload`,
 * which adds the full question list; the control page keeps the two in separate state (see
 * useChorusControl) since the version guard only ever applies to `state`.
 */

export type ChorusStatus = 'draft' | 'live' | 'ended'

/** 'answers': the host's prompts, answered by the audience. 'qna': the audience asks, votes, and
 * the host highlights one. */
export type ChorusMode = 'answers' | 'qna'

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
  mode: ChorusMode
  status: ChorusStatus
  /** 'qna' only: false while the host has paused new questions. Always true in 'answers' mode. */
  intakeOpen: boolean
  /** 'qna' only: the question the host put on the big screen (null = none). Always null in 'answers' mode. */
  highlight: { id: string; text: string } | null
  /** 'answers' only: the prompt on screen. Always null in 'qna' mode. */
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

/** One audience question in the Q&A feed. */
export interface QnaQuestionRow {
  id: string
  text: string
  createdAtMs: number
  votes: number
  answered: boolean
  /** Only ever true for the controller; everyone else is never sent hidden questions. */
  hidden: boolean
}

export interface QnaFeedPayload {
  feedVersion: number
  /** Unsorted; the client ranks them (see rankQuestions) so a refresh can keep the order stable. */
  questions: QnaQuestionRow[]
  /** Ids this device has voted for. Empty for the controller and presenter. */
  mine: string[]
}

/** One row of the account-level session lists (/my-rooms, the dashboard's Running tab, the room
 * card's "Link existing" picker). */
export interface ChorusSessionSummary {
  code: string
  name: string
  status: ChorusStatus
  linkedRoomId: string | null
  mode: ChorusMode
  /** Prompts in 'answers' mode; audience questions in 'qna' mode. */
  questionCount: number
  createdAt: number
}
