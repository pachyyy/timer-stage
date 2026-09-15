/**
 * Cookie-based locale, not URL-prefixed routing (`/en/...`, `/id/...`) — every existing route,
 * including a room's own `?t=` controller link and `/r/[roomId]` viewer link, keeps working
 * unchanged. A visitor's choice is read server-side from this cookie (see request.ts) rather than
 * detected from Accept-Language, so it stays deterministic and matches whatever the switcher
 * (src/components/locale-switcher.tsx) last set — defaults to English until they pick Indonesian.
 */
export const LOCALES = ['en', 'id'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_COOKIE = 'NEXT_LOCALE'

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value)
}
