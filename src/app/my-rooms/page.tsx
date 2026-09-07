'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { AuthButtons } from '@/components/auth-buttons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listControllerTokens } from '@/lib/auth/local-tokens'
import type { OwnedRoomSummary } from '@/lib/db/my-rooms'

/**
 * Cross-room view for a signed-in account: every room you own, plus an explicit (not automatic)
 * prompt to import any rooms this browser holds a controller token for but haven't been claimed
 * yet. Import is deliberately a reviewable button press, not silent on sign-in — a controller
 * link is routinely forwarded, so the person holding it in localStorage is often not the owner.
 */
export default function MyRoomsPage() {
  const { status } = useSession()
  const [rooms, setRooms] = useState<OwnedRoomSummary[] | null>(null)
  const [importing, setImporting] = useState(false)

  const refresh = useCallback(() => {
    fetch('/api/me/rooms')
      .then((res) => (res.ok ? res.json() : []))
      .then(setRooms)
      .catch(() => setRooms([]))
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    refresh()
  }, [status, refresh])

  // Derived, not stateful — listControllerTokens() is a synchronous localStorage read, so this is
  // a pure computation from `rooms` and belongs in render, not synced via a setState-in-effect.
  const importable = useMemo(() => {
    if (!rooms) return []
    const owned = new Set(rooms.map((r) => r.roomId))
    return listControllerTokens().filter((c) => !owned.has(c.roomId))
  }, [rooms])

  const handleImport = async () => {
    setImporting(true)
    await Promise.all(
      importable.map((c) =>
        fetch(`/api/rooms/${c.roomId}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: c.token }),
        }).catch(() => null),
      ),
    )
    setImporting(false)
    refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
          </Link>
          <h1 className="text-xl font-semibold">My Rooms</h1>
        </div>
        <AuthButtons />
      </div>

      {status === 'loading' && <p className="text-muted-foreground">Loading…</p>}

      {status === 'unauthenticated' && (
        <p className="text-sm text-muted-foreground">Sign in to see every room linked to your account.</p>
      )}

      {status === 'authenticated' && (
        <>
          {importable.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rooms on this browser aren&apos;t saved to your account</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {importable.length} room{importable.length === 1 ? '' : 's'} you created from this browser{' '}
                  {importable.length === 1 ? "isn't" : "aren't"} linked yet — import{' '}
                  {importable.length === 1 ? 'it' : 'them'} to control from any device.
                </p>
                <Button size="sm" onClick={handleImport} disabled={importing}>
                  {importing ? 'Importing…' : `Import ${importable.length}`}
                </Button>
              </CardContent>
            </Card>
          )}

          {!rooms ? (
            <p className="text-muted-foreground">Loading rooms…</p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rooms linked to your account yet — create one on the homepage while signed in.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rooms.map((room) => (
                <li key={room.roomId}>
                  <Card>
                    <CardContent className="flex items-center justify-between gap-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{room.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {room.runCount} run{room.runCount === 1 ? '' : 's'}
                          {room.lastRunAtMs &&
                            ` · last ${new Date(room.lastRunAtMs).toLocaleDateString(undefined, { dateStyle: 'medium' })}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <a href={`/r/${room.roomId}/history`}>History</a>
                        </Button>
                        <Button asChild size="sm">
                          <a href={`/r/${room.roomId}/control`}>Open</a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
