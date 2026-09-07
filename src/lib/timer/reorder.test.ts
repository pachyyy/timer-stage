import { describe, expect, it } from 'vitest'
import { applyReorder, isPermutation } from './reorder'

describe('applyReorder', () => {
  it('moves an item earlier', () => {
    expect(applyReorder(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('moves an item later', () => {
    expect(applyReorder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('is a no-op when from and to are the same index', () => {
    const ids = ['a', 'b', 'c']
    expect(applyReorder(ids, 1, 1)).toBe(ids)
  })

  it('is a no-op for an out-of-range index', () => {
    const ids = ['a', 'b', 'c']
    expect(applyReorder(ids, -1, 1)).toBe(ids)
    expect(applyReorder(ids, 1, 3)).toBe(ids)
  })

  it('does not mutate the input array', () => {
    const ids = ['a', 'b', 'c']
    applyReorder(ids, 0, 2)
    expect(ids).toEqual(['a', 'b', 'c'])
  })
})

describe('isPermutation', () => {
  const existing = ['t1', 't2', 't3']

  it('accepts a reordering of the same ids', () => {
    expect(isPermutation(['t3', 't1', 't2'], existing)).toBe(true)
  })

  it('accepts the identity order', () => {
    expect(isPermutation(existing, existing)).toBe(true)
  })

  it('rejects a missing id', () => {
    expect(isPermutation(['t1', 't2'], existing)).toBe(false)
  })

  it('rejects an extra/unknown id', () => {
    expect(isPermutation(['t1', 't2', 't3', 't4'], existing)).toBe(false)
  })

  it('rejects a duplicate id even at the right length', () => {
    expect(isPermutation(['t1', 't1', 't2'], existing)).toBe(false)
  })

  it('rejects an id that does not belong to this room at all', () => {
    expect(isPermutation(['t1', 't2', 'ghost'], existing)).toBe(false)
  })
})
