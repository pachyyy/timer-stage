# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # dev server at localhost:3000 (Turbopack)
npm run build           # production build
npm test                # vitest run — unit tests only, no browser/e2e suite exists
npx vitest run path/to/file.test.ts   # run a single test file
npx vitest              # watch mode
npm run lint             # eslint
npx tsc --noEmit         # typecheck (not wired into a script)

npm run db:generate       # after editing src/lib/db/schema.ts — writes a migration into drizzle/
npm run db:migrate         # applies drizzle/ migrations to local.db (or TURSO_DATABASE_URL if set)
npm run db:studio           # Drizzle Studio GUI on the current DB
```

No environment variables are required for local dev — `TURSO_DATABASE_URL` defaults to
`file:local.db` and realtime defaults to polling (see Transport layer below).

Always run `npx tsc --noEmit`, `npm test`, and `npm run lint` after a change — all three must be
clean before considering work done; also run `npm run build` before pushing, since Next's build
step catches route-typing issues the others don't.

## Architecture

Stage Timer: a controller screen drives a countdown, one or more fullscreen viewer screens
(confidence monitors) display it in sync. Next.js App Router + TypeScript + Tailwind + shadcn/ui;
Drizzle ORM over libSQL (Turso in prod, a local SQLite file in dev); Ably for realtime with an
automatic polling fallback.

### The core design: derived state, not streamed ticks

The single most important thing to understand before touching timer logic: the server never
broadcasts "42 seconds left." It broadcasts *anchor state* —
`{ status, startedAtMs, elapsedBeforeMs }` — and every client derives the displayed number locally
via pure functions in `src/lib/timer/model.ts` (`elapsedMs`, `remainingMs`, `start`, `pause`,
`reset`, `adjustElapsed`), evaluated against each client's own clock-offset-corrected timestamp
(`src/lib/sync/clock.ts`, exposed via the `useSyncedClock` hook as `syncedNow()`). Consequences
that matter when changing anything in this area:

- A viewer that loses network keeps counting correctly — there's nothing to receive.
- All screens show the identical number because it's the same arithmetic over the same inputs.
- The realtime channel only ever carries state *transitions* (~50 messages for a two-hour show),
  never per-second ticks — this is what keeps the Ably free tier viable.
- Every run-state mutation must go through `mutateRunState()` in `src/lib/db/room-state.ts`, which
  uses the *server's* `Date.now()` — never trust a client-supplied timestamp for a transition.

`room_state.version` is bumped on every mutation and included in every broadcast/poll response.
Clients discard any payload with `version <= current` (enforced once, centrally, in
`useRoomState`'s `applyPayload`) — this is what stops a delayed/out-of-order message from
resurrecting stale state and un-starting a live timer on stage. **Any new mutating route must call
`bumpVersion()` (or go through `mutateRunState`, which bumps it internally) even if it only touches
the agenda, not run state** — this was a real bug (agenda edits silently failing to reach an
already-synced client) fixed once already; don't reintroduce it.

Because the controller's own action response is otherwise indistinguishable from a stale poll, the
version-guarded setter (`applyPayload`, returned by `useRoomState`/`useRoom`) is also what every
mutating route's response should be piped into on the client — see `ControlPage`, where
`roomActions.pause(...).then(applyPayload)` makes the actor's own screen update instantly instead
of waiting for the next poll tick. Every mutating API route (`actions`, `timers`, `timers/[id]`)
returns the full fresh `RoomStatePayload` for exactly this reason — never shrink a response back
down to `{ ok: true }`.

### Transport layer (`src/lib/sync/`)

`RoomTransport` is the interface (`transport.ts`) the rest of the app codes against — pages never
know whether updates arrive via Ably or polling. `create-transport.ts` picks the implementation:
polling-only unless `NEXT_PUBLIC_REALTIME_ENABLED === 'true'` (which requires `ABLY_API_KEY`
server-side), in which case `CompositeTransport` wraps Ably with automatic polling fallback and an
authoritative resync fetch on every reconnect. To swap in a different realtime vendor, implement
`RoomTransport` in one new file — nothing else changes.

### Auth model (`src/lib/auth/guard.ts`)

No user accounts. `checkRoomAccess(roomId, token)` returns `'controller' | 'viewer' | 'none'` and
is the single gate every mutating route must call (reject anything but `'controller'`). Three
credential shapes all funnel through it:

- **Viewing is intentionally open by room code alone** — no token required, like a meeting ID.
  `'none'` only ever means the room doesn't exist.
- The room's own `controllerToken` (permanent, minted once at room creation) — the "admin".
- A **participant's** `sessionToken`, once an admin promotes their role to `'controller'` via the
  Participants panel (`src/app/api/rooms/[roomId]/participants/[participantId]/role`). This is
  what lets control be granted to a specific joined person without a second room-wide secret, and
  lets it be revoked by flipping the role back — `checkRoomAccess` re-resolves it on every request,
  so demotion takes effect on that person's very next action attempt, no session invalidation
  needed. Client-side, `useOwnRole`/`useParticipant` poll a participant's own role so a promotion or
  demotion reaches their screen proactively too, not just server-side enforcement.

Every viewer (direct link or the homepage's "join with code" tab — same code path either way) is
prompted for a name once, creating a `participants` row; that identity is what the admin's
Participants panel lists and can promote/demote. Session identity for both the classic controller
token and a joined participant is cached client-side in `localStorage` (`src/lib/auth/local-tokens.ts`,
`src/lib/auth/participant.ts`) so a refresh doesn't drop access — never trust that cache
server-side, it only survives a refresh, real authorization always re-checks against the DB.

### Data model (`src/lib/db/schema.ts`)

Four tables: `rooms` (controller/viewer tokens), `timers` (the agenda, `position`-ordered),
`room_state` (one row per room — the run-state anchor + `version`, kept separate from `rooms` so
bumping version is a single atomic write), `participants` (name, private `sessionToken`, `role`).
`src/lib/db/room-state.ts` is the only place that should read/write `room_state` — it's what keeps
the version-bump-on-every-mutation invariant enforceable in one place (`loadRoomStatePayload`,
`mutateRunState`, `bumpVersion`).

### Route structure

`/` — create a room, or join one by code (both land on the same `/r/[roomId]` flow).
`/r/[roomId]` — fullscreen viewer; name-gates via `useParticipant`, then renders `TimerDisplay`.
`/r/[roomId]/control` — the operator's dashboard; owns all the mutating action calls.
API routes mirror this under `/api/rooms/[roomId]/...` — `actions` (start/pause/reset/adjust/
select/blackout), `timers` (agenda CRUD), `participants` (join/list/promote-demote),
`share-links` (controller-only lookup of the room's viewer token), plus the standalone
`/api/time` (clock-sync reference, must stay `Cache-Control: no-store`) and `/api/ably/auth`
(issues scoped Ably tokens — the real Ably API key never reaches the browser).

## Deploying

See README.md's "Deploying" section for the current checklist (Turso provisioning, the
`vercel-build` script that runs `drizzle-kit migrate` automatically, optional Ably setup). The
short version: `vercel-build` (not `build`) is what Vercel actually runs when present, so a schema
change only needs `db:generate` locally — the migration applies itself on deploy.
