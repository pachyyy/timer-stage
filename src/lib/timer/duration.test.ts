import { describe, expect, it } from 'vitest'
import { parseDurationInput, toMinSec } from './minutes'

describe('parseDurationInput', () => {
  it('combines minutes and seconds into total ms', () => {
    expect(parseDurationInput('5', '30')).toBe(5 * 60_000 + 30_000)
  })

  it('accepts minutes-only', () => {
    expect(parseDurationInput('5', '0')).toBe(5 * 60_000)
  })

  it('accepts seconds-only, including seconds >= 60', () => {
    expect(parseDurationInput('0', '90')).toBe(90_000)
  })

  it('treats a blank/non-numeric field as zero for that unit', () => {
    expect(parseDurationInput('', '30')).toBe(30_000)
    expect(parseDurationInput('5', '')).toBe(5 * 60_000)
  })

  it('falls back when the total is zero', () => {
    expect(parseDurationInput('0', '0')).toBe(5 * 60_000)
    expect(parseDurationInput('0', '0', 60_000)).toBe(60_000)
  })

  it('ignores negative input for a field rather than propagating a negative total', () => {
    expect(parseDurationInput('-5', '30')).toBe(30_000)
  })
})

describe('toMinSec', () => {
  it('splits an exact minute duration', () => {
    expect(toMinSec(5 * 60_000)).toEqual({ minutes: 5, seconds: 0 })
  })

  it('splits a duration with remainder seconds', () => {
    expect(toMinSec(5 * 60_000 + 30_000)).toEqual({ minutes: 5, seconds: 30 })
  })

  it('rounds to the nearest second', () => {
    expect(toMinSec(59_600)).toEqual({ minutes: 1, seconds: 0 })
  })

  it('clamps a negative duration to zero', () => {
    expect(toMinSec(-1000)).toEqual({ minutes: 0, seconds: 0 })
  })

  it('round-trips with parseDurationInput', () => {
    const ms = 7 * 60_000 + 45_000
    const { minutes, seconds } = toMinSec(ms)
    expect(parseDurationInput(String(minutes), String(seconds))).toBe(ms)
  })
})
