import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { isAuthConfigured } from '@/lib/auth/config'
import { safeCallbackUrl } from '@/lib/auth/redirect'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GoogleSignInButton } from '@/components/google-sign-in-button'

export const dynamic = 'force-dynamic'

/**
 * Placeholder sign-in/sign-up page — both "Log in" and "Sign up" in the navbar land here
 * (?mode=signup only changes the heading below) since Google is the only credential path today
 * (see CLAUDE.md's Auth model). Also `auth.ts`'s own `pages.signIn`, so Auth.js redirects here on
 * its own sign-in flows too. `callbackUrl` is validated by safeCallbackUrl before use — it's an
 * untrusted query param.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; mode?: string }>
}) {
  const { callbackUrl, mode } = await searchParams
  const redirectTo = safeCallbackUrl(callbackUrl)

  const session = await auth()
  if (session?.user) redirect(redirectTo)

  const isSignup = mode === 'signup'
  const t = await getTranslations('login')

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{isSignup ? t('titleSignup') : t('titleLogin')}</CardTitle>
          <CardDescription>{isSignup ? t('descSignup') : t('descLogin')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isAuthConfigured() ? (
            <GoogleSignInButton redirectTo={redirectTo} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('notConfigured')}</p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
