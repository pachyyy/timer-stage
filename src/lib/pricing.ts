// Hardcoded display copy, deliberately not part of the CueLimits/pachy-core contract — price is
// Clepsy's own marketing concern. Edit directly when a price changes. Shared by /pricing, the landing
// page's pricing teaser and the footer, so the three can't quote different numbers.
export const ROOM_PRICE_IDR = 35_000
export const EXTRA_PARTICIPANT_PRICE_IDR = 5_000
export const CHORUS_PRICE_IDR = 15_000

/** 35000 -> "Rp35.000" (Indonesian thousands separator, without depending on the runtime's ICU data). */
export function formatRupiah(amount: number): string {
  return `Rp${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

export const ROOM_PRICE = formatRupiah(ROOM_PRICE_IDR)
export const EXTRA_PARTICIPANT_PRICE = formatRupiah(EXTRA_PARTICIPANT_PRICE_IDR)
export const CHORUS_PRICE = formatRupiah(CHORUS_PRICE_IDR)

/**
 * Bundles: a room is one event and a Chorus session is one presentation, so most events want one of
 * each. A bundle is just a manual top-up of these three amounts at a lower total price — there's
 * no checkout. The same three numbers are mirrored by the PACKS presets in
 * 03_pachy_panel/src/app/apps/[appId]/quota/quota-grant-form.tsx so the operator granting a paid
 * bundle doesn't retype them; keep the two in sync by hand when a bundle changes.
 */
export const PACKS = [
  { id: 'event', rooms: 1, chorus: 1, participants: 0, priceIdr: 45_000 },
  { id: 'trio', rooms: 3, chorus: 3, participants: 5, priceIdr: 150_000 },
  { id: 'season', rooms: 5, chorus: 5, participants: 10, priceIdr: 250_000 },
] as const

export type Pack = (typeof PACKS)[number]

/** What the same credits would cost bought one by one. */
export function packValueIdr(pack: Pack): number {
  return (
    pack.rooms * ROOM_PRICE_IDR +
    pack.chorus * CHORUS_PRICE_IDR +
    pack.participants * EXTRA_PARTICIPANT_PRICE_IDR
  )
}

/** Whole-percent saving against buying the credits one by one. */
export function packSavingPercent(pack: Pack): number {
  const value = packValueIdr(pack)
  return Math.round(((value - pack.priceIdr) / value) * 100)
}

// There's deliberately no self-serve checkout (see 03_pachy_panel/docs/ARCHITECTURE.md §1) —
// quota is topped up by hand from the panel. This is where a visitor is told how to actually buy
// more. International format, digits only, no leading "+" or "00" (wa.me's own requirement) —
// e.g. "6281234567890" for an Indonesian number starting with 0.
const UPGRADE_WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_UPGRADE_WHATSAPP || '6289654861141'

export function whatsappUrl(message = 'Hi, I want to buy Clepsy room/participant/Chorus credits'): string {
  return `https://wa.me/${UPGRADE_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
