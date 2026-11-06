import { describe, expect, it } from 'vitest'
import {
  afterDelete,
  applyChorusAction,
  clampFontPercent,
  classifyJoinCode,
  FONT_MAX_PERCENT,
  FONT_MIN_PERCENT,
  formatChorusCode,
  MAX_ANSWER_LENGTH,
  normalizeAnswer,
  stepQuestion,
  type PresentationState,
} from './model'

const ids = ['q1', 'q2', 'q3']
const draft: PresentationState = { status: 'draft', currentQuestionId: null, answerFontPercent: 100, intakeOpen: true }
const live = (currentQuestionId: string): PresentationState => ({
  status: 'live',
  currentQuestionId,
  answerFontPercent: 100,
  intakeOpen: true,
})

describe('applyChorusAction', () => {
  it('present opens the first question and flags the transition', () => {
    const result = applyChorusAction(draft, { action: 'present' }, ids)
    expect(result).toEqual({ ok: true, presented: true, next: { ...draft, status: 'live', currentQuestionId: 'q1' } })
  })

  it('present refuses with no questions, or when not a draft', () => {
    expect(applyChorusAction(draft, { action: 'present' }, [])).toEqual({ ok: false, error: 'no_questions' })
    expect(applyChorusAction(live('q1'), { action: 'present' }, ids)).toEqual({ ok: false, error: 'not_draft' })
  })

  it('next/prev move within bounds', () => {
    const next = applyChorusAction(live('q1'), { action: 'next' }, ids)
    expect(next.ok && next.next.currentQuestionId).toBe('q2')
    const prev = applyChorusAction(live('q2'), { action: 'prev' }, ids)
    expect(prev.ok && prev.next.currentQuestionId).toBe('q1')
  })

  it('navigation needs a live presentation', () => {
    expect(applyChorusAction(draft, { action: 'next' }, ids)).toEqual({ ok: false, error: 'not_live' })
    expect(applyChorusAction(draft, { action: 'end' }, ids)).toEqual({ ok: false, error: 'not_live' })
  })

  it('goto rejects an id that is not in the session', () => {
    expect(applyChorusAction(live('q1'), { action: 'goto', questionId: 'nope' }, ids)).toEqual({
      ok: false,
      error: 'unknown_question',
    })
    const ok = applyChorusAction(live('q1'), { action: 'goto', questionId: 'q3' }, ids)
    expect(ok.ok && ok.next.currentQuestionId).toBe('q3')
  })

  it('ended is terminal for everything but font size', () => {
    const ended = applyChorusAction(live('q2'), { action: 'end' }, ids)
    expect(ended).toEqual({ ok: true, ended: true, next: { ...live('q2'), status: 'ended' } })
    if (!ended.ok) return
    for (const action of ['present', 'next', 'prev', 'end'] as const) {
      expect(applyChorusAction(ended.next, { action }, ids).ok).toBe(false)
    }
    const font = applyChorusAction(ended.next, { action: 'font', deltaPercent: 10 }, ids)
    expect(font.ok && font.next.answerFontPercent).toBe(110)
  })
})

describe('applyChorusAction in qna mode', () => {
  const qids = ['a', 'b']
  const run = (state: PresentationState, input: Parameters<typeof applyChorusAction>[1]) =>
    applyChorusAction(state, input, qids, 'qna')
  const liveQna: PresentationState = { status: 'live', currentQuestionId: null, answerFontPercent: 100, intakeOpen: true }

  it('present works with no questions and highlights nothing', () => {
    const result = run(draft, { action: 'present' })
    expect(result).toEqual({ ok: true, presented: true, next: { ...draft, status: 'live', currentQuestionId: null } })
    expect(applyChorusAction(draft, { action: 'present' }, [], 'qna').ok).toBe(true)
  })

  it('highlight needs a live session and a known question', () => {
    expect(run(draft, { action: 'highlight', questionId: 'a' })).toEqual({ ok: false, error: 'not_live' })
    expect(run(liveQna, { action: 'highlight', questionId: 'nope' })).toEqual({ ok: false, error: 'unknown_question' })
    const ok = run(liveQna, { action: 'highlight', questionId: 'b' })
    expect(ok.ok && ok.next.currentQuestionId).toBe('b')
  })

  it('unhighlight clears the screen', () => {
    const result = run({ ...liveQna, currentQuestionId: 'a' }, { action: 'unhighlight' })
    expect(result.ok && result.next.currentQuestionId).toBeNull()
    expect(run(draft, { action: 'unhighlight' })).toEqual({ ok: false, error: 'not_live' })
  })

  it('intake can be paused and resumed until the session ends', () => {
    const paused = run(liveQna, { action: 'intake', open: false })
    expect(paused.ok && paused.next.intakeOpen).toBe(false)
    const resumed = paused.ok ? run(paused.next, { action: 'intake', open: true }) : paused
    expect(resumed.ok && resumed.next.intakeOpen).toBe(true)
    expect(run({ ...liveQna, status: 'ended' }, { action: 'intake', open: false })).toEqual({ ok: false, error: 'ended' })
  })

  it('prompt navigation is not a Q&A action, and the reverse', () => {
    for (const input of [{ action: 'next' }, { action: 'prev' }, { action: 'goto', questionId: 'a' }] as const) {
      expect(run(liveQna, input)).toEqual({ ok: false, error: 'unknown_action' })
    }
    for (const input of [{ action: 'unhighlight' }, { action: 'intake', open: false }] as const) {
      expect(applyChorusAction(live('q1'), input, ids)).toEqual({ ok: false, error: 'unknown_action' })
    }
  })

  it('ended is terminal for everything but font size', () => {
    const ended = run(liveQna, { action: 'end' })
    expect(ended.ok && ended.ended).toBe(true)
    if (!ended.ok) return
    for (const input of [{ action: 'present' }, { action: 'end' }, { action: 'unhighlight' }, { action: 'highlight', questionId: 'a' }] as const) {
      expect(run(ended.next, input).ok).toBe(false)
    }
    const font = run(ended.next, { action: 'font', deltaPercent: -20 })
    expect(font.ok && font.next.answerFontPercent).toBe(80)
  })
})

describe('stepQuestion', () => {
  it('stops at either end instead of wrapping', () => {
    expect(stepQuestion(ids, 'q3', 1)).toBe('q3')
    expect(stepQuestion(ids, 'q1', -1)).toBe('q1')
  })

  it('restarts from the first question when the current id is gone', () => {
    expect(stepQuestion(ids, 'deleted', 1)).toBe('q1')
    expect(stepQuestion([], 'q1', 1)).toBeNull()
  })
})

describe('afterDelete', () => {
  it('leaves the current question alone when another one is deleted', () => {
    expect(afterDelete(ids, 'q1', 'q2')).toBe('q1')
  })

  it('moves to the next question, or the new last one', () => {
    expect(afterDelete(ids, 'q2', 'q2')).toBe('q3')
    expect(afterDelete(ids, 'q3', 'q3')).toBe('q2')
    expect(afterDelete(['q1'], 'q1', 'q1')).toBeNull()
  })
})

describe('clampFontPercent', () => {
  it('clamps to the allowed range and rounds', () => {
    expect(clampFontPercent(1000)).toBe(FONT_MAX_PERCENT)
    expect(clampFontPercent(1)).toBe(FONT_MIN_PERCENT)
    expect(clampFontPercent(104.6)).toBe(105)
    expect(clampFontPercent(Number.NaN)).toBe(100)
  })
})

describe('normalizeAnswer', () => {
  it('trims and rejects empty or over-long answers', () => {
    expect(normalizeAnswer('  hello  ')).toBe('hello')
    expect(normalizeAnswer('   ')).toBeNull()
    expect(normalizeAnswer('x'.repeat(MAX_ANSWER_LENGTH + 1))).toBeNull()
    expect(normalizeAnswer(42)).toBeNull()
  })
})

describe('classifyJoinCode', () => {
  it('routes six digits to Chorus and anything else to a room', () => {
    expect(classifyJoinCode('482913')).toEqual({ kind: 'chorus', code: '482913' })
    expect(classifyJoinCode(' 482 913 ')).toEqual({ kind: 'chorus', code: '482913' })
    expect(classifyJoinCode('k3f9qz')).toEqual({ kind: 'room', code: 'K3F9QZ' })
    expect(classifyJoinCode('12345')).toEqual({ kind: 'room', code: '12345' })
    expect(classifyJoinCode('  ')).toBeNull()
  })
})

describe('formatChorusCode', () => {
  it('splits a six-digit code into two groups', () => {
    expect(formatChorusCode('482913')).toBe('482 913')
    expect(formatChorusCode('ABC')).toBe('ABC')
  })
})
