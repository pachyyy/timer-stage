import { getTranslations } from 'next-intl/server'
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
const ROOM_PRICE = 'Rp35.000'
const EXTRA_PARTICIPANT_PRICE = 'Rp5.000'

export default async function PricingPage() {
  const t = await getTranslations('pricing')

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('roomsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-2xl font-semibold">
              {ROOM_PRICE}{' '}
              <span className="text-base font-normal text-muted-foreground">{t('roomsUnit')}</span>
            </p>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>
                •{' '}
                {t('roomsBullet1', {
                  free: FREE_PARTICIPANTS_PER_ROOM,
                  segments: SEGMENTS_PER_QUOTA_ROOM,
                })}
              </li>
              <li>• {t('roomsBullet2')}</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('participantsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-2xl font-semibold">
              {EXTRA_PARTICIPANT_PRICE}{' '}
              <span className="text-base font-normal text-muted-foreground">{t('participantsUnit')}</span>
            </p>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>• {t('participantsBullet1', { free: FREE_PARTICIPANTS_PER_ROOM })}</li>
              <li>• {t('participantsBullet2')}</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">{t('noCheckout')}</p>
          <Button asChild>
            <a
              href={`https://wa.me/${UPGRADE_WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi, I want to buy Cue room/participant credits')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('whatsappCta')}
            </a>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
