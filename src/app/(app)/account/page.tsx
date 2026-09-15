'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** The one account-level setting Cue has today: display name (shown in the gear menu and, via
 * `runs.label`/room ownership, nowhere the participant side can see — this is controller-only
 * identity, not anything a viewer or joined participant is exposed to). */
export default function AccountPage() {
  const { data: session, status, update } = useSession()
  // null = the field hasn't been touched yet — falls back to the session's own name so it starts
  // populated without needing an effect to copy it in (see set-state-in-effect lint rule).
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const name = nameDraft ?? session?.user?.name ?? ''
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const t = useTranslations('account')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to save.')
      // Database sessions (see auth.ts) mean the name is already updated server-side by the PATCH
      // above — this just forces useSession() to refetch so it reflects here immediately.
      await update()
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">{tNav('account')}</h1>

      {status === 'loading' && <p className="text-muted-foreground">{tCommon('loading')}</p>}

      {status === 'unauthenticated' && <p className="text-sm text-muted-foreground">{t('signInHint')}</p>}

      {status === 'authenticated' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('profileTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <Input id="email" value={session?.user?.email ?? ''} disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t('nameLabel')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setNameDraft(e.target.value)
                  setSaved(false)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">{t('nameHint')}</p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && !error && <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('saved')}</p>}

            <Button onClick={handleSave} disabled={saving || !name.trim()} className="self-start">
              {saving ? tCommon('saving') : tCommon('save')}
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
