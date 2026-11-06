import { describe, expect, it } from 'vitest'
import { MAX_ASKED_LENGTH } from './model'
import { groupQuestions, normalizeAsked, rankQuestions, sortRecent } from './qna'
import type { QnaQuestionRow } from './types'

const q = (id: string, votes: number, createdAtMs: number, extra: Partial<QnaQuestionRow> = {}): QnaQuestionRow => ({
  id,
  text: id,
  votes,
  createdAtMs,
  answered: false,
  hidden: false,
  ...extra,
})

describe('rankQuestions', () => {
  it('orders by votes, then newest first', () => {
    const ranked = rankQuestions([q('old-popular', 5, 100), q('new-quiet', 1, 900), q('new-popular', 5, 500), q('mid-quiet', 1, 400)])
    expect(ranked.map((x) => x.id)).toEqual(['new-popular', 'old-popular', 'new-quiet', 'mid-quiet'])
  })

  it('breaks full ties by id so the order is stable', () => {
    expect(rankQuestions([q('b', 1, 10), q('a', 1, 10)]).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('does not mutate its input', () => {
    const input = [q('a', 1, 1), q('b', 2, 2)]
    rankQuestions(input)
    expect(input.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('sortRecent', () => {
  it('puts the newest question first', () => {
    expect(sortRecent([q('a', 9, 1), q('b', 0, 3), q('c', 0, 2)]).map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('groupQuestions', () => {
  it('separates open, answered and hidden, each ranked', () => {
    const groups = groupQuestions([
      q('open-low', 1, 1),
      q('open-high', 4, 2),
      q('done', 9, 3, { answered: true }),
      q('gone', 7, 4, { hidden: true }),
      q('gone-answered', 7, 5, { hidden: true, answered: true }),
    ])
    expect(groups.open.map((x) => x.id)).toEqual(['open-high', 'open-low'])
    expect(groups.answered.map((x) => x.id)).toEqual(['done'])
    expect(groups.hidden.map((x) => x.id)).toEqual(['gone-answered', 'gone'])
  })
})

describe('normalizeAsked', () => {
  it('trims and rejects empty or over-long input', () => {
    expect(normalizeAsked('  hello  ')).toBe('hello')
    expect(normalizeAsked('   ')).toBeNull()
    expect(normalizeAsked(42)).toBeNull()
    expect(normalizeAsked('x'.repeat(MAX_ASKED_LENGTH))).toHaveLength(MAX_ASKED_LENGTH)
    expect(normalizeAsked('x'.repeat(MAX_ASKED_LENGTH + 1))).toBeNull()
  })
})
