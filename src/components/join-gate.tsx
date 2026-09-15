'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Shown before a viewer sees the timer — lets the admin know who's watching, and is the
 * identity a promotion to controller attaches to. `removed` shows a distinct notice when this is
 * reached because the admin removed the previous session, not just a first-time visit. */
export function JoinGate({
  onJoin,
  removed = false,
}: {
  onJoin: (name: string) => Promise<void>
  removed?: boolean
}) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations('joinGate')

  const submit = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onJoin(name.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'))
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-6">
        <div>
          <h1 className="text-lg font-semibold text-white">{removed ? t('removedTitle') : t('joinTitle')}</h1>
          <p className="mt-1 text-sm text-white/50">{removed ? t('removedDesc') : t('joinDesc')}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="join-name" className="text-white/70">
            {t('yourNameLabel')}
          </Label>
          <Input
            id="join-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="border-white/20 bg-white/10 text-white placeholder:text-white/30"
            placeholder={t('namePlaceholder')}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button onClick={submit} disabled={submitting || !name.trim()}>
          {submitting ? t('joining') : t('join')}
        </Button>
      </div>
    </div>
  )
}
