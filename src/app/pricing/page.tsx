import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FREE_PARTICIPANTS_PER_ROOM, SEGMENTS_PER_QUOTA_ROOM } from '@/lib/entitlements/gate'

export const dynamic = 'force-dynamic'

// There's deliberately no self-serve checkout (see 03_pachy_panel/docs/ARCHITECTURE.md §1) —
// quota is topped up by hand from the panel. This is where a visitor is told how to actually buy
// more. International format, digits only, no leading "+" or "00" (wa.me's own requirement) —
// e.g. "6281234567890" for an Indonesian number starting with 0.
const UPGRADE_WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_UPGRADE_WHATSAPP || '6289654861141'

// Hardcoded display copy, deliberately not part of the CueLimits/pachy-core contract — price is
// Cue's own marketing concern. Edit directly when a price changes; FREE_PARTICIPANTS_PER_ROOM and
// SEGMENTS_PER_QUOTA_ROOM above are imported (not retyped) so this page can never say a number
// that disagrees with what src/lib/entitlements/gate.ts actually enforces.
const ROOM_PRICE = 'Rp25.000'
const EXTRA_PARTICIPANT_PRICE = 'Rp5.000'

export default function PricingPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image src="/cue.svg" alt="" width={28} height={28} unoptimized className="rounded-md" />
          <span className="text-lg font-semibold">Cue</span>
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-2 text-muted-foreground">
          Every room is free to view and join by code — no account needed. What follows only
          applies to creating and owning rooms.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rooms</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-2xl font-semibold">
              {ROOM_PRICE} <span className="text-base font-normal text-muted-foreground">/ room</span>
            </p>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>• Includes {FREE_PARTICIPANTS_PER_ROOM} participants, full run history, .xlsx export, and up to {SEGMENTS_PER_QUOTA_ROOM} segments</li>
              <li>• Good for one event — once the show ends, that room is done. Your next event needs its own room.</li>
              <li>• Your first room is free — no purchase needed to try Cue.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Extra participants</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-2xl font-semibold">
              {EXTRA_PARTICIPANT_PRICE} <span className="text-base font-normal text-muted-foreground">/ person</span>
            </p>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>• Only if a room needs more than {FREE_PARTICIPANTS_PER_ROOM} people watching or controlling it</li>
              <li>• Buy a batch up front and use it across any of your rooms, whenever you need it</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            No self-serve checkout yet — message us on WhatsApp with how many rooms and/or extra
            participants you want and the account email to put them on, and we&apos;ll top up your
            balance.
          </p>
          <Button asChild>
            <a
              href={`https://wa.me/${UPGRADE_WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi, I want to buy Cue room/participant credits')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chat on WhatsApp
            </a>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
