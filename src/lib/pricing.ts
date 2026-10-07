// Hardcoded display copy, deliberately not part of the CueLimits/pachy-core contract — price is
// Clepsy's own marketing concern. Edit directly when a price changes. Shared by /pricing, the landing
// page's pricing teaser and the footer, so the three can't quote different numbers.
export const ROOM_PRICE = 'Rp35.000'
export const EXTRA_PARTICIPANT_PRICE = 'Rp5.000'

// There's deliberately no self-serve checkout (see 03_pachy_panel/docs/ARCHITECTURE.md §1) —
// quota is topped up by hand from the panel. This is where a visitor is told how to actually buy
// more. International format, digits only, no leading "+" or "00" (wa.me's own requirement) —
// e.g. "6281234567890" for an Indonesian number starting with 0.
const UPGRADE_WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_UPGRADE_WHATSAPP || '6289654861141'

export function whatsappUrl(message = 'Hi, I want to buy Clepsy room/participant credits'): string {
  return `https://wa.me/${UPGRADE_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
