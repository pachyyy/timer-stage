import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-4 py-16">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <Image src="/cue.svg" alt="" width={40} height={40} unoptimized className="rounded-md" />
          <h1 className="bg-[linear-gradient(135deg,var(--primary-gradient-from),var(--primary-gradient-to))] bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
            Cue
          </h1>
        </div>
        <p className="mt-3 text-lg text-muted-foreground">
          A shared countdown timer for live events, synced across every screen.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/login?mode=signup">Sign up free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Have a room code?</CardTitle>
          <CardDescription>Join as a viewer or crew member — no account needed.</CardDescription>
        </CardHeader>
        <CardContent>
          <JoinRoomForm />
        </CardContent>
      </Card>
    </main>
  )
}
