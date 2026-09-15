'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Room-code entry, shared by the landing page's join box and the navbar's "Join a room" dialog
 * (see site-navbar.tsx). No existence check here — the viewer page itself shows a clear "Room not
 * found" state for a bad code, so there's no need for a round trip before navigating. Joining
 * never requires an account (see CLAUDE.md's Auth model: "Viewing is intentionally open by room
 * code alone").
 */
export function JoinRoomForm({ className }: { className?: string }) {
  const router = useRouter()
  const [code, setCode] = useState('')

  const join = () => {
    const trimmed = code.trim()
    if (!trimmed) return
    router.push(`/r/${trimmed}`)
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="join-code">Room code</Label>
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
        Join room
      </Button>
    </div>
  )
}
