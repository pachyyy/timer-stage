import { describe, expect, it } from 'vitest'
import { generateChorusCode, generateRoomId } from './tokens'

describe('generateChorusCode', () => {
  it('is always exactly six digits', () => {
    for (let i = 0; i < 500; i++) expect(generateChorusCode()).toMatch(/^\d{6}$/)
  })
})

describe('generateRoomId', () => {
  it('never produces an all-digit code, which would be read as a Chorus code', () => {
    // Short ids make an all-digit roll common (8 of 32 symbols are digits), so the re-roll path
    // is actually exercised here.
    for (let i = 0; i < 2000; i++) expect(generateRoomId(2)).not.toMatch(/^\d+$/)
  })

  it('keeps the six-character default', () => {
    expect(generateRoomId()).toMatch(/^[A-Z2-9]{6}$/)
  })
})
