'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { AuthButtons } from '@/components/auth-buttons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listControllerTokens } from '@/lib/auth/local-tokens'
import type { OwnedRoomSummary } from '@/lib/db/my-rooms'
import type { CueLimits } from '@/lib/entitlements/types'

interface MyEntitlement {
  planKey: string
  planName: string
  limits: CueLimits
}

/**
 * Cross-room view for a signed-in account: every room you own, plus an explicit (not automatic)
 * prompt to import any rooms this browser holds a controller token for but haven't been claimed
 * yet. Import is deliberately a reviewable button press, not silent on sign-in — a controller
 * link is routinely forwarded, so the person holding it in localStorage is often not the owner.
 *
 * Also where a room gets archived — the only thing that removes it from this account's
 * active-room count against its plan (see rooms.archivedAt in schema.ts). Archiving never touches
 * the room itself: its agenda, history, and viewer link keep working.
 */
export default function MyRoomsPage() {
  const { status } = useSession()
  const [rooms, setRooms] = useState<OwnedRoomSummary[] | null>(null)
  const [entitlement, setEntitlement] = useState<MyEntitlement | null>(null)
  const [importing, setImporting] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)

  const refresh = useCallback(() => {
    fetch('/api/me/rooms')
      .then((res) => (res.ok ? res.json() : []))
      .then(setRooms)
      .catch(() => setRooms([]))
    fetch('/api/me/entitlement')
      .then((res) => (res.ok ? res.json() : null))
      .then(setEntitlement)
      .catch(() => setEntitlement(null))
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

  const activeRooms = useMemo(() => rooms?.filter((r) => !r.archivedAt) ?? [], [rooms])
  const archivedRooms = useMemo(() => rooms?.filter((r) => r.archivedAt) ?? [], [rooms])

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

  const toggleArchive = async (roomId: string, archive: boolean) => {
    setArchivingId(roomId)
    try {
      await fetch(`/api/rooms/${roomId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: archive }),
      })
      refresh()
    } finally {
      setArchivingId(null)
    }
  }

  const cap = entitlement?.limits.activeRooms ?? null

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Image src="/cue.svg" alt="" width={24} height={24} unoptimized className="rounded-md" />
          </Link>
          <h1 className="text-xl font-semibold">My Rooms</h1>
          {entitlement && (
            <Badge variant="secondary" className="ml-1">
              {entitlement.planName}
            </Badge>
          )}
        </div>
        <AuthButtons />
      </div>

      {status === 'loading' && <p className="text-muted-foreground">Loading…</p>}

      {status === 'unauthenticated' && (
        <p className="text-sm text-muted-foreground">Sign in to see every room linked to your account.</p>
      )}

      {status === 'authenticated' && (
        <>
          {cap !== null && (
            <p className="text-xs text-muted-foreground">
              {activeRooms.length} of {cap} active room{cap === 1 ? '' : 's'} used.{' '}
              {activeRooms.length >= cap && (
                <Link href="/pricing" className="text-primary underline-offset-4 hover:underline">
                  See plans →
                </Link>
              )}
            </p>
          )}

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
            <>
              <ul className="flex flex-col gap-2">
                {activeRooms.map((room) => (
                  <RoomRow
                    key={room.roomId}
                    room={room}
                    archiving={archivingId === room.roomId}
                    onToggleArchive={() => toggleArchive(room.roomId, true)}
                  />
                ))}
              </ul>

              {archivedRooms.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    {archivedRooms.length} archived room{archivedRooms.length === 1 ? '' : 's'}
                  </summary>
                  <ul className="mt-2 flex flex-col gap-2">
                    {archivedRooms.map((room) => (
                      <RoomRow
                        key={room.roomId}
                        room={room}
                        archived
                        archiving={archivingId === room.roomId}
                        onToggleArchive={() => toggleArchive(room.roomId, false)}
                      />
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </>
      )}
    </main>
  )
}

function RoomRow({
  room,
  archived = false,
  archiving,
  onToggleArchive,
}: {
  room: OwnedRoomSummary
  archived?: boolean
  archiving: boolean
  onToggleArchive: () => void
}) {
  return (
    <li>
      <Card className={archived ? 'opacity-70' : undefined}>
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 font-medium">
              {room.name}
              {archived && (
                <Badge variant="outline" className="text-xs font-normal">
                  Archived
                </Badge>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {room.runCount} run{room.runCount === 1 ? '' : 's'}
              {room.lastRunAtMs &&
                ` · last ${new Date(room.lastRunAtMs).toLocaleDateString(undefined, { dateStyle: 'medium' })}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onToggleArchive} disabled={archiving}>
              {archiving ? '…' : archived ? 'Unarchive' : 'Archive'}
            </Button>
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
  )
}
