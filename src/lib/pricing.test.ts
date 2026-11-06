import { describe, expect, it } from 'vitest'
import { CHORUS_PRICE, PACKS, ROOM_PRICE, formatRupiah, packSavingPercent, packValueIdr, whatsappUrl } from './pricing'

describe('formatRupiah', () => {
  it('uses dots as thousands separators', () => {
    expect(formatRupiah(5_000)).toBe('Rp5.000')
    expect(formatRupiah(250_000)).toBe('Rp250.000')
    expect(formatRupiah(1_250_000)).toBe('Rp1.250.000')
  })

  it('keeps the displayed unit prices', () => {
    expect(ROOM_PRICE).toBe('Rp35.000')
    expect(CHORUS_PRICE).toBe('Rp15.000')
  })
})

describe('packs', () => {
  it('values each pack against buying the credits one by one', () => {
    const [event, trio, season] = PACKS
    expect(packValueIdr(event)).toBe(50_000)
    expect(packValueIdr(trio)).toBe(175_000)
    expect(packValueIdr(season)).toBe(300_000)
  })

  it('always costs less than buying the same credits a la carte', () => {
    for (const pack of PACKS) {
      expect(pack.priceIdr).toBeLessThan(packValueIdr(pack))
      expect(packSavingPercent(pack)).toBeGreaterThan(0)
    }
  })

  it('rounds the saving to a whole percent', () => {
    expect(PACKS.map(packSavingPercent)).toEqual([10, 14, 17])
  })
})

describe('whatsappUrl', () => {
  it('encodes the message into the wa.me link', () => {
    const url = whatsappUrl('Hi & bye')
    expect(url).toContain('https://wa.me/')
    expect(url).toContain('text=Hi%20%26%20bye')
  })
})
