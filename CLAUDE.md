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
`file:local.db`, realtime defaults to polling, and Google sign-in is simply absent if its three
`AUTH_*` vars are unset (see Auth model below).

Always run `npx tsc --noEmit`, `npm test`, and `npm run lint` after a change — all three must be
clean before considering work done; also run `npm run build` before pushing, since Next's build
step catches route-typing issues the others don't. Every new schema change needs `npm run
db:generate` committed alongside it — see Deploying.

## Architecture

Stage Timer (product name "Cue"): a controller screen drives a countdown, one or more fullscreen
viewer screens (confidence monitors) display it in sync. Next.js App Router + TypeScript +
Tailwind + shadcn/ui; Drizzle ORM over libSQL (Turso in prod, a local SQLite file in dev); Ably for
realtime with an automatic polling fallback; Auth.js v5 for optional Google sign-in.

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
authoritative resync fetch on every reconnect. On the server side, `publish.ts`'s
`publishRoomState()` is what actually pushes a fresh payload to a room's Ably channel after a
mutation — it's a best-effort REST publish (no-ops silently if `ABLY_API_KEY` isn't set), separate
from the DB write itself. To swap in a different realtime vendor, implement `RoomTransport` in one
new file and call its equivalent of `publishRoomState` from the mutating routes — nothing else
changes.

### Auth model: tokens are primary, accounts are additive

Two independent, layered credential systems both funnel into one gate.

**Tokens** (`src/lib/auth/guard.ts`) are the original, account-free model and still work
byte-for-byte the same with nobody ever signing in. `checkRoomAccess(roomId, token, userId?)`
returns `'controller' | 'viewer' | 'none'` and is the framework-decoupled core every route
ultimately checks (reject anything but `'controller'`). Three things can resolve to `'controller'`:

- The room's own `controllerToken` (permanent, minted once at room creation) — the "admin".
- A **participant's** `sessionToken`, once an admin promotes their role to `'controller'` via the
  Participants panel (`src/app/api/rooms/[roomId]/participants/[participantId]/role`). This is
  what lets control be granted to a specific joined person without a second room-wide secret, and
  lets it be revoked by flipping the role back — `checkRoomAccess` re-resolves it on every request,
  so demotion takes effect on that person's very next action attempt, no session invalidation
  needed. Client-side, `useOwnRole`/`useParticipant` poll a participant's own role so a promotion or
  demotion reaches their screen proactively too, not just server-side enforcement.
- `userId` matching the room's `ownerUserId` (see below) — an account that owns the room.

**Viewing is intentionally open by room code alone** — no token or account required, like a
meeting ID. `'none'` only ever means the room doesn't exist.

Every viewer (direct link or the homepage's "join with code" tab — same code path either way) is
prompted for a name once, creating a `participants` row; that identity is what the admin's
Participants panel lists and can promote/demote. Session identity for both the classic controller
token and a joined participant is cached client-side in `localStorage` (`src/lib/auth/local-tokens.ts`,
`src/lib/auth/participant.ts`) so a refresh doesn't drop access — never trust that cache
server-side, it only survives a refresh, real authorization always re-checks against the DB.

**Accounts** (`src/auth.ts`, Auth.js v5 + `@auth/drizzle-adapter`, Google provider, database
sessions) are entirely optional and additive: with no `AUTH_*` env vars set, sign-in UI simply
doesn't render, and every anonymous/token flow above is unaffected. Signing in only links a room
you create to `rooms.ownerUserId`, which — per `checkRoomAccess` above — grants **full control
from any device, with no token at all**. `src/lib/auth/session-guard.ts`'s `resolveRoomAccess(roomId,
token)` is what every controller-gated route calls instead of `checkRoomAccess` directly: it
resolves the current session via `auth()` and passes `session.user.id` through, keeping
`guard.ts` itself framework-decoupled.

**Non-obvious gotcha:** Auth.js's *default* `session` callback rebuilds `session.user` from
scratch with only `name`/`email`/`image` — it silently drops `id` unless a `session` callback
restores it (see the one in `src/auth.ts`). Every owner check in this app depends on
`session.user.id`; if that callback is ever removed, all of the above degrades silently (session
paths just always resolve to `'viewer'`/no access) rather than throwing.

A room created before ever signing in isn't retroactively linked — its controller token still
lives in that browser's `localStorage`. `POST /api/rooms/[roomId]/claim` links it explicitly
(rejects if the token doesn't match or the room already has a different owner);
`listControllerTokens()` in `local-tokens.ts` is what `/my-rooms` uses to offer that import.

### Data model (`src/lib/db/schema.ts`)

- `rooms` — controller/viewer tokens, `name`, nullable `ownerUserId` (`set null` on account
  deletion, never destroys a live room).
- `timers` — the agenda, `position`-ordered, with `scheduledStartMs` (optional, informational
  wall-clock start — never auto-starts anything).
- `room_state` — one row per room: the run-state anchor + `version` (kept separate from `rooms` so
  bumping version is a single atomic write), plus `currentRunId` (the open run, or null — see
  below).
- `participants` — name, private `sessionToken`, `role`.
- `runs` / `run_events` — the history/reporting log (see next section).
- `user` / `account` / `session` / `verificationToken` — Auth.js's own expected shape for
  `@auth/drizzle-adapter`, hand-matched column-for-column rather than imported from the adapter, so
  `drizzle-kit`'s introspection stays free of adapter runtime code. Naming intentionally follows
  Auth.js's camelCase/singular convention rather than this file's own snake_case-plural style.

`src/lib/db/room-state.ts` is the only place that should read/write `room_state` — it's what keeps
the version-bump-on-every-mutation invariant enforceable in one place (`loadRoomStatePayload`,
`mutateRunState`, `bumpVersion`).

### Run history and reporting (`src/lib/history/`, `src/lib/db/run-log.ts`)

A `run` opens lazily on the first `'start'` after a room has no open run (`ensureOpenRun`), and
closes on an explicit "End show" action or an automatic rollover if the previous run's last event
is over `STALE_RUN_MS` (12h) old (`shouldRolloverRun` — otherwise a next-day rehearsal would
silently append to last week's show). The agenda itself is untouched by a run closing, so the same
segments can be run again as a new run.

Every transition through `mutateRunState` optionally logs a `run_events` row via `logEvent` —
**there is deliberately no separate mutable "segment summary" table.** Planned-vs-actual, the
adjustments list, and the full timeline are all *computed* from the immutable event stream by pure
functions (`src/lib/history/report.ts`'s `buildRunReport`, `adjustments.ts`'s
`coalesceAdjustments`), so there's exactly one write path and no risk of the summary and the
timeline disagreeing. "Actual" time is the sum of real wall-clock intervals between transitions
(`closeInterval` in `report.ts`), deliberately not derived from `elapsedBeforeMs` — that field is a
display quantity that `TimerModel.adjustElapsed` allows to go negative, not a measurement.
Consecutive same-direction time adjustments on the same segment coalesce into one report line
(e.g. "+2 min (2 × +1 min)"); raw events keep full fidelity regardless.

`.xlsx` export (`src/lib/export/run-workbook.ts`, via `exceljs` — not the unmaintained `xlsx`
package) builds a 3-sheet workbook (Summary / Events / Adjustments) from the same
`buildRunReport`/`coalesceAdjustments` output the on-screen history view uses, so the spreadsheet
can never drift from what's displayed. The export route runs on `runtime = 'nodejs'` (exceljs uses
Node buffers/zlib, incompatible with Edge) and returns a plain Web `Response` rather than
`NextResponse`, since `NextResponse`'s types don't accept a raw `Uint8Array` body.

### Agenda editing and reorder (`src/components/agenda-list.tsx`, `src/lib/timer/reorder.ts`)

Drag-to-reorder uses `@dnd-kit` (not native HTML5 drag-and-drop, which doesn't fire on touch —
this list is operated from tablets) via a dedicated drag handle, not whole-row dragging, since a
row's primary click already means "select this segment and reset the timer." `applyReorder` is a
pure array-splice helper shared between the optimistic client-side reorder and the bulk `PATCH
/api/rooms/[roomId]/timers` route's own validation (`isPermutation`) that an incoming `order`
array is a genuine permutation of the room's existing timer ids before it's allowed to overwrite
every segment's position in one `db.batch()` write. Deliberately one bulk endpoint on the
collection route rather than N individual position updates, which would be racy and bump `version`
N times mid-drag.

### Route structure

`/` — create a room, join one by code, or (signed in) jump back into a currently-live event via
the "Running Event" tab. All land on the same `/r/[roomId]` flow.
`/r/[roomId]` — fullscreen viewer; name-gates via `useParticipant`, then renders `TimerDisplay`.
`/r/[roomId]/control` — the operator's dashboard; owns all the mutating action calls.
`/r/[roomId]/history` and `/r/[roomId]/history/[runId]` — read-only, deliberately don't mount
`useRoom`/a transport connection, since there's no live timer to keep synced.
`/my-rooms` — cross-room view for a signed-in account: every room it owns, plus an explicit
(button-press, not automatic-on-sign-in) prompt to import rooms this browser holds a controller
token for.

API routes mirror this under `/api/rooms/[roomId]/...` — `actions` (start/pause/reset/adjust/
select/blackout/end), `timers` (agenda CRUD + bulk reorder), `runs`/`runs/[runId]`/`runs/[runId]/export`
(history, controller-gated), `participants` (join/list/promote-demote), `share-links`
(controller-only lookup of the room's viewer token), `claim` (link an anonymously-created room to
the signed-in account), plus the standalone `/api/time` (clock-sync reference, must stay
`Cache-Control: no-store`), `/api/ably/auth` (issues scoped Ably tokens — the real Ably API key
never reaches the browser), `/api/auth/[...nextauth]` (Auth.js), and `/api/me/rooms` /
`/api/me/live-rooms` (account-scoped, no roomId param at all — every owned room, and every owned
room with a currently open run, respectively).

### Pricing: prepaid quota, not subscription tiers (`src/lib/entitlements/`, `src/lib/db/quota.ts`)

Cue's monetization is a prepaid-credits model: a signed-in account has a `roomQuota` (room
credits) and `userQuota` (extra-participant credits), tracked in **this app's own database**
(`accountQuota`/`quotaLedger` in `schema.ts`), not in the shared `03_pachy_panel` control-plane DB
(`pachy-core`). That's deliberate — see `accountQuota`'s doc comment: spending a credit has to
happen atomically with the room/participant row it's paying for, which only works if the counter
and that row share a database and a single conditional `UPDATE`. `pachy-core` still matters for
exactly one thing: detecting the `permanent` plan, a hand-picked, fully-uncapped grant that
bypasses quota entirely (see the panel's seed script). Nothing else about pricing lives there
anymore — a signed-in account with no `permanent` grant is "on quota," full stop; there's no
separate free/mid/top plan concept for them beyond their starter balance.

- **The economics**: every room includes `FREE_PARTICIPANTS_PER_ROOM` (3) participants and
  `SEGMENTS_PER_QUOTA_ROOM` (30) segments, history, and export, for free — those aren't metered.
  What's metered is room count and participants beyond 3. A brand-new account's starter balance
  (`quota.ts`'s `STARTER_ROOM_QUOTA` = 1, `userQuota` = 0) *is* the free tier now — this is what
  keeps a first-time visitor able to try the product without buying anything, playing the same
  role the old "free plan" did.
- **`quota.ts`** is the only code that touches `accountQuota`/`quotaLedger`. `tryConsumeRoomQuota`
  and `tryConsumeUserQuota` are a conditional atomic `UPDATE ... WHERE quota > 0`, not
  read-then-write — that's the actual race-safety; a gate's own balance check beforehand is just a
  friendly early message. Every successful consume or grant appends one `quotaLedger` row (mirrors
  the panel's own `audit_log` philosophy: it's the only answer to "why is my balance what it is").
- **`gate.ts`**: `canCreateRoom` spends 1 `roomQuota` the moment it says yes (not a pure check like
  its siblings — see its doc comment); `canJoinParticipant` lets the first 3 through free, then
  spends 1 `userQuota` per joiner; `canViewHistory`/`canExportRun` are just "is there a signed-in
  owner at all"; `canAddSegments` is a flat cap (5 anonymous / 30 signed-in); `canStartRun` is the
  single-use lock (below). All six are a no-op (`{ allowed: true }`) unless
  `ENTITLEMENTS_ENFORCED=true` — the kill switch **defaults to off**.
- **Anonymous room creation is never capped, quota or otherwise** — quota is an account-scoped
  concept, an anonymous room has no account to bill, and capping it would mean requiring sign-in
  to create any room at all (the "free = 0 rooms" outcome the pricing design has always rejected).
  Anonymous rooms keep the old flat fallback (`defaults.ts`'s `FALLBACK_LIMITS`) for
  segments/history/export/participants, completely unrelated to quota.
- **"One room credit = one event"** (`canStartRun`): a signed-in, non-`permanent` room can
  complete exactly one run. Checked in the actions route BEFORE calling `mutateRunState` (that
  function's closure is synchronous, no room for an async quota lookup) — resuming/restarting
  *within* a still-open run is always fine (`hasOpenRun`); this only blocks opening a genuinely NEW
  run on a room that already closed one. It has to cover the automatic 12h-stale rollover
  (`src/lib/history/rollover.ts`) too, not just an explicit "End show" — otherwise never clicking
  "End show" would be a free way to dodge the lock forever.
- "Active room" / `rooms.archivedAt` predates quota and is now just a `/my-rooms` declutter
  flag — archiving doesn't free up or affect any credit.
- A blocked mutation returns `402` with `{ error: "<message safe to show directly>" }` — see the
  homepage's `createRoom`, `useParticipant`'s `join`, `JoinGate`, `room-actions.ts`'s shared
  `request()` helper, and the control page's "Add" segment / Start buttons, which all thread that
  message through rather than showing a generic failure.
- **`/pricing`** is flat display copy (`ROOM_PRICE`, `EXTRA_PARTICIPANT_PRICE` — edit directly when
  a price changes) plus a WhatsApp CTA (`NEXT_PUBLIC_UPGRADE_WHATSAPP`) — there is no self-serve
  checkout by design.
- **Granting quota**: the panel's `/apps/cue/quota` calls this app's own
  `POST/GET /api/admin/v1/quota` (guarded by `ADMIN_API_TOKEN`, see `src/lib/admin-api/auth.ts`) —
  the first implemented piece of the admin-API contract from `docs/ARCHITECTURE.md` §7, built here
  specifically because quota balances live in this app's DB, not the panel's. A grant requires the
  email to have signed into Cue at least once (`accountQuota` is keyed on our own `userId`, not
  email) — the route returns a clear 404 if not.

## Deploying

See README.md's "Deploying" section for the current checklist (Turso provisioning, the
`vercel-build` script that runs `drizzle-kit migrate` automatically, optional Ably setup, optional
Google OAuth setup). The short version: `vercel-build` (not `build`) is what Vercel actually runs
when present, so a schema change only needs `db:generate` locally — the migration applies itself on
deploy.

Additionally for entitlements/quota:

- `PACHY_CORE_URL` / `PACHY_CORE_READONLY_TOKEN` (a read-only token for the panel's `pachy-core`
  Turso DB) and `PACHY_APP_ID=cue` — used only to detect the `permanent` bypass now.
- `ADMIN_API_TOKEN` — a random secret (`openssl rand -base64 32`), shared with the panel's
  `APP_TOKEN_CUE` for the same value. This is what guards `/api/admin/v1/*`; without it every
  admin-API request 404s, and the panel's `/apps/cue/quota` can't top anyone up.
- Leave `ENTITLEMENTS_ENFORCED` unset/`false` after deploying, watch real traffic resolve
  correctly, then flip it to `true` once confident — see `src/lib/entitlements/gate.ts`.
