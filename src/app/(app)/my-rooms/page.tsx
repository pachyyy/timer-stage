'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listControllerTokens } from '@/lib/auth/local-tokens'
import type { OwnedRoomSummary } from '@/lib/db/my-rooms'

interface MyQuota {
  isPermanent: boolean
  roomQuota: number | null
  userQuota: number | null
}

/**
 * Cross-room view for a signed-in account: every room you own, plus an explicit (not automatic)
 * prompt to import any rooms this browser holds a controller token for but haven't been claimed
 * yet. Import is deliberately a reviewable button press, not silent on sign-in — a controller
 * link is routinely forwarded, so the person holding it in localStorage is often not the owner.
 *
 * Also where a room gets archived — purely a declutter flag now (see rooms.archivedAt's doc
 * comment in schema.ts); it doesn't free up any quota. Archiving never touches the room itself:
 * its agenda, history, and viewer link keep working.
 */
export default function MyRoomsPage() {
  const { status } = useSession()
  const [rooms, setRooms] = useState<OwnedRoomSummary[] | null>(null)
  const [quota, setQuota] = useState<MyQuota | null>(null)
  const [importing, setImporting] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const t = useTranslations('myRooms')
  const tCommon = useTranslations('common')
  const tNav = useTranslations('nav')

  const refresh = useCallback(() => {
    fetch('/api/me/rooms')
      .then((res) => (res.ok ? res.json() : []))
      .then(setRooms)
      .catch(() => setRooms([]))
    fetch('/api/me/entitlement')
      .then((res) => (res.ok ? res.json() : null))
      .then(setQuota)
      .catch(() => setQuota(null))
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

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">{tNav('myRooms')}</h1>
        {quota?.isPermanent && (
          <Badge variant="secondary" className="ml-1">
            {t('permanentBadge')}
          </Badge>
        )}
      </div>

      {status === 'loading' && <p className="text-muted-foreground">{tCommon('loading')}</p>}

      {status === 'unauthenticated' && <p className="text-sm text-muted-foreground">{t('signInHint')}</p>}

      {status === 'authenticated' && (
        <>
          {quota && !quota.isPermanent && (
            <p className="text-xs text-muted-foreground">
              {t('creditsLine', { rooms: quota.roomQuota ?? 0, users: quota.userQuota ?? 0 })}{' '}
              {(quota.roomQuota ?? 0) <= 0 && (
                <Link href="/pricing" className="text-primary underline-offset-4 hover:underline">
                  {tCommon('buyMore')}
                </Link>
              )}
            </p>
          )}

          {importable.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('importTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{t('importDesc', { count: importable.length })}</p>
                <Button size="sm" onClick={handleImport} disabled={importing}>
                  {importing ? t('importing') : t('importButton', { count: importable.length })}
                </Button>
              </CardContent>
            </Card>
          )}

          {!rooms ? (
            <p className="text-muted-foreground">{t('loadingRooms')}</p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noRooms')}</p>
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
                    {t('archivedCount', { count: archivedRooms.length })}
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
  const t = useTranslations('myRooms')

  return (
    <li>
      <Card className={archived ? 'opacity-70' : undefined}>
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 font-medium">
              {room.name}
              {archived && (
                <Badge variant="outline" className="text-xs font-normal">
                  {t('archivedBadge')}
                </Badge>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('runCount', { count: room.runCount })}
              {room.lastRunAtMs &&
                ` · ${t('lastRun', { date: new Date(room.lastRunAtMs).toLocaleDateString(undefined, { dateStyle: 'medium' }) })}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onToggleArchive} disabled={archiving}>
              {archiving ? '…' : archived ? t('unarchive') : t('archive')}
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/r/${room.roomId}/history`}>{t('history')}</a>
            </Button>
            <Button asChild size="sm">
              <a href={`/r/${room.roomId}/control`}>{t('open')}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  )
}
