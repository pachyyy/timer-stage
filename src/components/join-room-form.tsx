'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { classifyJoinCode } from '@/lib/chorus/model'

/**
 * Code entry, shared by the landing page's join box and the navbar's "Join a room" dialog
 * (see site-navbar.tsx). One box for both kinds of code: six digits is a Chorus session, anything
 * else a timer room — see classifyJoinCode. No existence check here — the viewer page itself shows a clear "Room not
 * found" state for a bad code, so there's no need for a round trip before navigating. Joining
 * never requires an account (see CLAUDE.md's Auth model: "Viewing is intentionally open by room
 * code alone").
 */
export function JoinRoomForm({ className }: { className?: string }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const t = useTranslations('joinForm')

  const join = () => {
    const target = classifyJoinCode(code)
    if (!target) return
    router.push(target.kind === 'chorus' ? `/c/${target.code}` : `/r/${target.code}`)
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="join-code">{t('label')}</Label>
        <Input
          id="join-code"
          placeholder="e.g. 8QZDV2"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && join()}
          className="font-mono text-lg tracking-widest uppercase"
        />
      </div>
      <Button onClick={join} disabled={!code.trim()} size="lg" className="mt-3 w-full">
        {t('button')}
      </Button>
    </div>
  )
}
