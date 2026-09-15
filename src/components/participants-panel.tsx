'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface ParticipantRow {
  id: string
  name: string
  role: 'viewer' | 'controller'
  joinedAt: number
}

const POLL_INTERVAL_MS = 5000

/** Admin view of everyone who has joined the room, with promote/demote controls. Polls rather
 * than relying on the realtime channel — join/role events are rare enough that a plain interval
 * is simpler than adding another broadcast payload shape. */
export function ParticipantsPanel({ roomId, token }: { roomId: string; token: string }) {
  const [rows, setRows] = useState<ParticipantRow[] | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null)
  const t = useTranslations('participantsPanel')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/participants?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
        })
        if (cancelled || !res.ok) return
        setRows((await res.json()) as ParticipantRow[])
      } catch {
        // transient — next tick retries
      }
    }

    void load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [roomId, token])

  const setRole = async (participantId: string, role: 'viewer' | 'controller') => {
    setPendingId(participantId)
    try {
      await fetch(`/api/rooms/${roomId}/participants/${participantId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, role }),
      })
      setRows((prev) => prev?.map((p) => (p.id === participantId ? { ...p, role } : p)) ?? null)
    } finally {
      setPendingId(null)
    }
  }

  const removeParticipant = async (participantId: string) => {
    setPendingId(participantId)
    try {
      await fetch(`/api/rooms/${roomId}/participants/${participantId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      // Applied locally rather than waiting for the next poll — same pattern setRole already uses.
      setRows((prev) => prev?.filter((p) => p.id !== participantId) ?? null)
    } finally {
      setPendingId(null)
      setPendingRemove(null)
    }
  }

  if (!rows) return <p className="text-sm text-muted-foreground">{t('loading')}</p>
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t('empty')}</p>

  return (
    <>
      <ul className="flex flex-col gap-1">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <span className="truncate">{p.name}</span>
            <span className="flex shrink-0 items-center gap-2">
              {p.role === 'controller' ? (
                <>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {t('controllerBadge')}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pendingId === p.id}
                    onClick={() => setRole(p.id, 'viewer')}
                  >
                    {t('demote')}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingId === p.id}
                  onClick={() => setRole(p.id, 'controller')}
                >
                  {t('makeController')}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={pendingId === p.id}
                onClick={() => setPendingRemove({ id: p.id, name: p.name })}
              >
                {t('remove')}
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pendingRemove !== null}
        title={t('removeTitle')}
        description={
          pendingRemove
            ? t(
                rows.find((p) => p.id === pendingRemove.id)?.role === 'controller'
                  ? 'removeDescController'
                  : 'removeDescViewer',
                { name: pendingRemove.name },
              )
            : ''
        }
        confirmLabel={t('remove')}
        onConfirm={() => pendingRemove && removeParticipant(pendingRemove.id)}
        onCancel={() => setPendingRemove(null)}
      />
    </>
  )
}
