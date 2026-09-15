'use client'

import { useTranslations } from 'next-intl'

/** Shown wherever a controller-only page can't resolve a token from the URL or localStorage —
 * the history list/detail pages and the control page all hit this same dead end the same way. */
export function MissingToken() {
  const t = useTranslations('missingToken')
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('desc')}</p>
    </main>
  )
}
