import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listPublicPlans } from '@/lib/entitlements/client'
import type { CueLimits } from '@/lib/entitlements/types'

export const dynamic = 'force-dynamic'

// There's deliberately no self-serve checkout (see 03_pachy_panel/docs/ARCHITECTURE.md §1) —
// plans are granted by email, by hand. This is where a visitor is told how to actually get one.
const UPGRADE_EMAIL = process.env.NEXT_PUBLIC_UPGRADE_EMAIL || 'hello@example.com'

function limitLines(limits: CueLimits): string[] {
  return [
    limits.activeRooms === null ? 'Unlimited active rooms' : `${limits.activeRooms} active room${limits.activeRooms === 1 ? '' : 's'}`,
    limits.history ? 'Full run history' : 'No run history',
    limits.export ? '.xlsx export' : 'No export',
    limits.participantsPerRoom === null
      ? 'Unlimited participants per room'
      : `${limits.participantsPerRoom} participants per room`,
  ]
}

export default async function PricingPage() {
  const plans = await listPublicPlans()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image src="/cue.svg" alt="" width={28} height={28} unoptimized className="rounded-md" />
          <span className="text-lg font-semibold">Cue</span>
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Plans</h1>
        <p className="mt-2 text-muted-foreground">
          Every room is free to view and join by code — no account needed. These limits apply only
          to the account that owns a room.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.key} className={plan.key === 'top' ? 'border-primary' : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {plan.name}
                {plan.key === 'top' && <Badge>Most rooms</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {limitLines(plan.limits).map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            No self-serve checkout yet — email us which plan you want and the account email to put
            it on, and we&apos;ll set it up.
          </p>
          <Button asChild>
            <a href={`mailto:${UPGRADE_EMAIL}?subject=${encodeURIComponent('Cue plan upgrade')}`}>
              Email to upgrade
            </a>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
