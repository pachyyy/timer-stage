import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FREE_PARTICIPANTS_PER_ROOM, SEGMENTS_PER_QUOTA_ROOM } from '@/lib/entitlements/gate'
// Prices are imported, as are the two limits above, so this page can never quote a number that
// disagrees with the landing page or with what src/lib/entitlements/gate.ts actually enforces.
import {
  CHORUS_PRICE,
  EXTRA_PARTICIPANT_PRICE,
  PACKS,
  ROOM_PRICE,
  formatRupiah,
  packSavingPercent,
  packValueIdr,
  whatsappUrl,
  type Pack,
} from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const PACK_NAME_KEY = { event: 'packEvent', trio: 'packTrio', season: 'packSeason' } as const
const PACK_DESC_KEY = { event: 'packEventDesc', trio: 'packTrioDesc', season: 'packSeasonDesc' } as const

export default async function PricingPage() {
  const t = await getTranslations('pricing')

  /** What a bundle contains, as short display lines (zero amounts left out). */
  const packLines = (pack: Pack) => [
    t('packRooms', { count: pack.rooms }),
    t('packChorus', { count: pack.chorus }),
    ...(pack.participants > 0 ? [t('packParticipants', { count: pack.participants })] : []),
  ]

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

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle>{t('chorusTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-2xl font-semibold">
              {CHORUS_PRICE}{' '}
              <span className="text-base font-normal text-muted-foreground">{t('chorusUnit')}</span>
            </p>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>• {t('chorusBullet1')}</li>
              <li>• {t('chorusBullet2')}</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight">{t('packsTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('packsSubtitle')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PACKS.map((pack) => {
            const lines = packLines(pack)
            const name = t(PACK_NAME_KEY[pack.id])
            const price = formatRupiah(pack.priceIdr)
            return (
              <Card key={pack.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <p className="text-2xl font-semibold">{price}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('packWorth', {
                      value: formatRupiah(packValueIdr(pack)),
                      percent: packSavingPercent(pack),
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">{t(PACK_DESC_KEY[pack.id])}</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {lines.map((line) => (
                      <li key={line}>• {line}</li>
                    ))}
                  </ul>
                  <Button asChild className="mt-auto">
                    <a
                      href={whatsappUrl(
                        t('packMessage', { pack: name, price, contents: lines.join(', ') }),
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('packBuy')}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

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
