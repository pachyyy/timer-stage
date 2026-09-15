'use client'

import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

/** The one credential path today (see CLAUDE.md's Auth model) — "log in" and "sign up" both land
 * here (src/app/(marketing)/login/page.tsx) and start the same Google flow. `redirectTo` has
 * already been validated by safeCallbackUrl (src/lib/auth/redirect.ts) before it reaches here. */
export function GoogleSignInButton({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations('login')
  return (
    <Button size="lg" className="w-full" onClick={() => signIn('google', { redirectTo })}>
      {t('continueGoogle')}
    </Button>
  )
}
