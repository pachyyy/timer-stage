import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FREE_PARTICIPANTS_PER_ROOM, SEGMENTS_PER_QUOTA_ROOM } from '@/lib/entitlements/gate'
// Prices are imported, as are the two limits above, so this page can never quote a number that
// disagrees with the landing page or with what src/lib/entitlements/gate.ts actually enforces.
import { EXTRA_PARTICIPANT_PRICE, ROOM_PRICE, whatsappUrl } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

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
              href={whatsappUrl()}
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
