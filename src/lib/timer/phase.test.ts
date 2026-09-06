import { describe, it, expect } from 'vitest'
import { blinkStep, phaseFor, BLINK_WINDOW_MS } from './phase'

describe('phaseFor', () => {
  it('reports overtime once remaining goes negative', () => {
    expect(phaseFor(-1, 60_000)).toBe('overtime')
  })

  it('treats the wrap-up threshold itself as wrap-up', () => {
    expect(phaseFor(60_000, 60_000)).toBe('wrapup')
    expect(phaseFor(60_001, 60_000)).toBe('normal')
  })
})

describe('blinkStep', () => {
  it('does not blink outside the final minute', () => {
    expect(blinkStep(BLINK_WINDOW_MS + 1)).toBeNull()
  })

  it('does not blink in overtime, so a timer left running never strobes forever', () => {
    expect(blinkStep(-1)).toBeNull()
    expect(blinkStep(-90_000)).toBeNull()
  })

  it('starts the cycle exactly at the window boundary', () => {
    expect(blinkStep(BLINK_WINDOW_MS)).toBe(0)
  })

  it('advances one step per second as the count descends', () => {
    // black -> red -> white -> black, matching the order the operator asked for
    expect(blinkStep(60_000)).toBe(0)
    expect(blinkStep(59_000)).toBe(1)
    expect(blinkStep(58_000)).toBe(2)
    expect(blinkStep(57_000)).toBe(0)
  })

  it('still cycles through the last few seconds and zero', () => {
    expect(blinkStep(3_000)).toBe(0)
    expect(blinkStep(2_000)).toBe(1)
    expect(blinkStep(1_000)).toBe(2)
    expect(blinkStep(0)).toBe(0)
  })

  it('rounds the same way the digits do, so colour and text flip on the same frame', () => {
    // formatDuration rounds, so 58_600ms already displays as "0:59" and must show 59's colour.
    expect(blinkStep(58_600)).toBe(blinkStep(59_000))
    expect(blinkStep(58_400)).toBe(blinkStep(58_000))
  })
})
