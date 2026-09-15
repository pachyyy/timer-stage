'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { LOCALE_COOKIE, type Locale } from './locale'

/**
 * Server Action backing LocaleSwitcher (src/components/locale-switcher.tsx). Sets the cookie
 * request.ts reads, then revalidates the whole tree so every already-rendered Server Component
 * (which read the OLD locale's messages before this ran) re-renders with the new one — a plain
 * cookie write alone wouldn't do that on its own for the current page.
 */
export async function setLocale(locale: Locale) {
  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  revalidatePath('/', 'layout')
}
