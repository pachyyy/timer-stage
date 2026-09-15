import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { JoinRoomForm } from '@/components/join-room-form'

export const dynamic = 'force-dynamic'

/**
 * Public landing page. Signed-in visitors are sent straight to /dashboard — there's nothing for
 * them to do here (see CLAUDE.md's Route structure once this lands). Everyone else gets a
 * placeholder pitch plus the join-by-code box, since joining never requires an account (see
 * CLAUDE.md's Auth model: "Viewing is intentionally open by room code alone").
 *
 * Placeholder only — the user will design this page's actual content/layout later.
 */
export default async function LandingPage() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')

  const t = await getTranslations('landing')

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-4 py-16">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <Image src="/cue.svg" alt="" width={40} height={40} unoptimized className="rounded-md" />
          <h1 className="bg-[linear-gradient(135deg,var(--primary-gradient-from),var(--primary-gradient-to))] bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
            Cue
          </h1>
        </div>
        <p className="mt-3 text-lg text-muted-foreground">{t('tagline')}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/login?mode=signup">{t('signupCta')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">{t('pricingCta')}</Link>
          </Button>
        </div>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('codeCardTitle')}</CardTitle>
          <CardDescription>{t('codeCardDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <JoinRoomForm />
        </CardContent>
      </Card>
    </main>
  )
}
