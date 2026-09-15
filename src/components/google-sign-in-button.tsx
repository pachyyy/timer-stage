'use client'

import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'

/** The one credential path today (see CLAUDE.md's Auth model) — "log in" and "sign up" both land
 * here (src/app/(marketing)/login/page.tsx) and start the same Google flow. `redirectTo` has
 * already been validated by safeCallbackUrl (src/lib/auth/redirect.ts) before it reaches here. */
export function GoogleSignInButton({
  redirectTo,
  label = 'Continue with Google',
}: {
  redirectTo: string
  label?: string
}) {
  return (
    <Button size="lg" className="w-full" onClick={() => signIn('google', { redirectTo })}>
      {label}
    </Button>
  )
}
