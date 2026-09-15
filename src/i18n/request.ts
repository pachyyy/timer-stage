import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from './locale'

/**
 * Server-side locale resolution for every render AND every `getTranslations()` call from a route
 * handler (e.g. the quota/gate messages in src/lib/entitlements/gate.ts) — both go through this,
 * so a signed-in visitor's cookie choice reaches server-generated strings too, not just page copy.
 * No middleware involved (this app deliberately has none — see auth.ts): reading the cookie here
 * is enough, since every request already runs through Next's own server rendering.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
