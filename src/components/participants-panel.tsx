'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

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

  if (!rows) return <p className="text-sm text-muted-foreground">Loading participants…</p>
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No one has joined yet.</p>

  return (
    <ul className="flex flex-col gap-1">
      {rows.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
          <span className="truncate">{p.name}</span>
          <span className="flex shrink-0 items-center gap-2">
            {p.role === 'controller' ? (
              <>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Controller
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === p.id}
                  onClick={() => setRole(p.id, 'viewer')}
                >
                  Demote
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={pendingId === p.id}
                onClick={() => setRole(p.id, 'controller')}
              >
                Make controller
              </Button>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
