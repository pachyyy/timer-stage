# Stage Timer

A shared countdown timer for live events — a controller screen drives the show, one or more
fullscreen viewer screens (confidence monitors) display it in sync.

## How it stays in sync

The server never broadcasts "42 seconds left." It broadcasts *anchor state* — `startedAtMs`,
`elapsedBeforeMs`, `status` — and every client derives the displayed number locally from its own
clock-offset-corrected timestamp (see [src/lib/timer/model.ts](src/lib/timer/model.ts) and
[src/lib/sync/clock.ts](src/lib/sync/clock.ts)). That means a viewer that loses network keeps
counting correctly, all screens agree exactly, and the realtime channel only carries state
*transitions* (~50 messages for a two-hour show), not per-second ticks.

Every mutation bumps a `version` counter that's included in every broadcast; clients discard any
payload with `version <= current`, so a delayed/out-of-order message can never resurrect stale
state and un-start a live timer on stage.

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Drizzle ORM + libSQL (Turso) — `file:local.db` locally, Turso in production (see below)
- Ably for realtime fan-out, with automatic polling fallback

## Getting started

```bash
npm install
npm run db:migrate   # applies drizzle/ migrations to local.db
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables are required to run
locally — the DB defaults to a local SQLite file and realtime defaults to polling.

## Environment variables

Copy `.env.example` to `.env.local` and fill in as needed (see that file for details):

- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — leave unset for local dev.
- `ABLY_API_KEY` — leave unset to run on polling alone.
- `NEXT_PUBLIC_REALTIME_ENABLED` — set to `"true"` once `ABLY_API_KEY` is configured.

## Database

Schema lives in [src/lib/db/schema.ts](src/lib/db/schema.ts). After changing it:

```bash
npm run db:generate  # writes a new migration into drizzle/
npm run db:migrate    # applies it
```

## Tests

```bash
npm test
```

Covers the pure timer-transition model and the clock-offset estimation algorithm (with mocked,
deliberately asymmetric round trips) — see `src/lib/timer/model.test.ts` and
`src/lib/sync/clock.test.ts`.

## Deploying

Deploy to Vercel as usual (`vercel.json` pins the function region so all clients sync against the
same reference clock). Before going live:

1. Provision a Turso database (turso.tech) and set `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` in
   the Vercel project's environment variables.
2. Vercel runs `vercel-build` instead of `build` when it's present — it's set here to
   `drizzle-kit migrate && next build`, so schema migrations apply automatically on every deploy
   using those same env vars. No manual migration step needed.
3. Optional: provision an Ably app (ably.com), set `ABLY_API_KEY` and
   `NEXT_PUBLIC_REALTIME_ENABLED=true`. Without this the app runs on polling alone — fully
   functional, just up to ~2s of latency on cross-screen updates instead of near-instant.
   `NEXT_PUBLIC_*` vars are inlined at build time, so flipping this later requires a redeploy.

If you use Vercel preview deployments, point them at a separate Turso database (or at least be
aware `vercel-build` will run migrations against whatever DB the preview's env vars target).

## What's not in v1

Count-up / time-of-day timer modes, messaging/cues to the speaker screen, moderator view, a
separate agenda-display screen, user accounts, and theming. The schema and transport layer are
laid out so these are additive rather than restructuring work.
