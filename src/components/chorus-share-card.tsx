'use client'

import { useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { QRCodeSVG } from 'qrcode.react'
import { MonitorUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { openPresenterWindow, presenterUrl } from '@/lib/api/chorus-actions'
import { formatChorusCode } from '@/lib/chorus/model'

const subscribeNoop = () => () => {}

/** `window.location.origin` without a hydration mismatch: empty on the server, real on the client. */
export function useOrigin(): string {
  return useSyncExternalStore(subscribeNoop, () => window.location.origin, () => '')
}

/**
 * The operator's share panel: a QR code and the 6-digit code for the audience, plus the presenter
 * window's link and the button that opens it. The audience URL carries no token at all — knowing
 * the code is enough to answer, by design.
 */
export function ChorusShareCard({ code, presenterToken }: { code: string; presenterToken: string | null }) {
  const t = useTranslations('chorusShare')
  const tCommon = useTranslations('common')
  const origin = useOrigin()
  const [copied, setCopied] = useState<'audience' | 'presenter' | null>(null)

  const audienceUrl = origin ? `${origin}/c/${code}` : ''
  const presenterLink = origin && presenterToken ? `${origin}${presenterUrl(code, presenterToken)}` : ''

  const copy = (which: 'audience' | 'presenter', text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied((c) => (c === which ? null : c)), 5000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="shrink-0 rounded-md bg-white p-2">
            {audienceUrl ? <QRCodeSVG value={audienceUrl} size={128} marginSize={0} /> : <div className="size-32" />}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t('scanHint')}</span>
            <span className="text-xs text-muted-foreground">{t('codeLabel')}</span>
            <span className="font-mono text-3xl font-semibold tracking-widest tabular-nums">{formatChorusCode(code)}</span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm text-muted-foreground">{t('audienceLinkLabel')}</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={audienceUrl} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" onClick={() => copy('audience', audienceUrl)}>
              {copied === 'audience' ? tCommon('copied') : tCommon('copy')}
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm text-muted-foreground">{t('presenterLinkLabel')}</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={presenterLink} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" onClick={() => copy('presenter', presenterLink)} disabled={!presenterLink}>
              {copied === 'presenter' ? tCommon('copied') : tCommon('copy')}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{t('presenterHint')}</p>
        </div>

        <Button
          variant="secondary"
          onClick={() => presenterToken && openPresenterWindow(code, presenterToken)}
          disabled={!presenterToken}
          className="self-start"
        >
          <MonitorUp className="size-4" /> {t('openPresenter')}
        </Button>
      </CardContent>
    </Card>
  )
}
