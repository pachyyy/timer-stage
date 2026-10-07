# Clepsy

A shared countdown timer for live events. One operator runs the clock, and every screen — the stage
monitor, a tablet, anyone's phone — shows the same time, in sync. Named after the *klepsydra*, the
water clock that timed speakers in ancient Athenian courts.

Live at [cuetimed.vercel.app](https://cuetimed.vercel.app) · user guide at
[/docs](https://cuetimed.vercel.app/docs).

## What it does

- **Rooms and agendas** — a room holds one event: an ordered agenda of segments (drag to reorder,
  link a segment to start the next automatically, optional scheduled start, speaker and notes).
- **Operator panel** — start/pause (or the Space bar), ±1 min, black out every screen, send a
  message banner to the screens, end the event.
- **Screens** — any browser, by link or room code: amber wrap-up warning, a final-minute flash,
  red overtime. They keep counting through a dropped connection.
- **Participants** — anyone joins with the room code and a name, no account needed. The operator
  can give any participant control and take it back.
- **History** — every event's planned-vs-actual report, adjustment list and timeline, exportable
  as `.xlsx`.
- **Accounts and credits** — optional Google sign-in; signed-in owners control their rooms from any
  device. Rooms and extra participants are prepaid credits, topped up from the Pachy Panel.
- **English and Bahasa Indonesia**, chosen per visitor.

## How it stays in sync

The server never broadcasts "42 seconds left." It broadcasts *anchor state* — `startedAtMs`,
`elapsedBeforeMs`, `status` — and every client derives the displayed number locally from its own
clock-offset-corrected timestamp (see [src/lib/timer/model.ts](src/lib/timer/model.ts) and
[src/lib/sync/clock.ts](src/lib/sync/clock.ts)). That means a screen that loses network keeps
counting correctly, all screens agree exactly, and the realtime channel only carries state
*transitions* (~50 messages for a two-hour event), not per-second ticks.

Every mutation bumps a `version` counter that's included in every broadcast; clients discard any
payload with `version <= current`, so a delayed or out-of-order message can never resurrect stale
state and un-start a live timer on stage.

[CLAUDE.md](CLAUDE.md) is the detailed architecture guide — auth model, data model, history,
pricing, i18n and the terminology glossary.

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Drizzle ORM + libSQL (Turso) — `file:local.db` locally, Turso in production
- Ably for realtime fan-out, with automatic polling fallback
- Auth.js v5 (Google) for optional accounts
- next-intl for English / Bahasa Indonesia
- exceljs for the `.xlsx` export
- Remotion for the docs' animated walkthroughs ([video/](video/README.md), a separate package)

## Getting started

```bash
npm install
npm run db:migrate   # applies drizzle/ migrations to local.db
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables are required to run
locally — the DB defaults to a local SQLite file, realtime defaults to polling, and sign-in simply
doesn't appear until it's configured.

## Environment variables

Copy `.env.example` to `.env.local` and fill in as needed — that file documents each one:

| Variable | Purpose |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Production database. Leave unset for local dev. |
| `ABLY_API_KEY`, `NEXT_PUBLIC_REALTIME_ENABLED` | Realtime. Leave unset to run on polling alone. |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google sign-in. All three or none. |
| `PACHY_CORE_URL`, `PACHY_CORE_READONLY_TOKEN`, `PACHY_APP_ID` | Read-only lookup of the Pachy Panel's `permanent` plan. |
| `ADMIN_API_TOKEN` | Guards `/api/admin/v1/*`, which the panel uses to top up credits. |
| `ENTITLEMENTS_ENFORCED` | Kill switch for every credit/limit check — off unless `"true"`. |
| `NEXT_PUBLIC_UPGRADE_WHATSAPP` | The WhatsApp number on Pricing and in the footer. |

`PACHY_APP_ID` stays `cue` — it's this app's id in the panel's shared database, from before the
rename (see CLAUDE.md's naming note).

## Database

Schema lives in [src/lib/db/schema.ts](src/lib/db/schema.ts). After changing it:

```bash
npm run db:generate  # writes a new migration into drizzle/
npm run db:migrate   # applies it
```

## Checks

```bash
npm test             # vitest — unit tests, no browser suite
npx tsc --noEmit     # typecheck
npm run lint
npm run build        # catches route-typing issues the others don't
```

Tests cover the pure timer model, clock-offset estimation, phase/blink timing, agenda reorder, the
history report and its adjustments, run rollover, safe redirects, and that every docs section has
copy in both languages and its GIF.

## Docs animations

The GIFs on `/docs` and the landing page are rendered from code by the Remotion project in
[video/](video/README.md), using the app's own components, theme and copy. After changing UI they
show:

```bash
cd video && npm install && npm run gifs
```

## Deploying

Deploy to Vercel (`vercel.json` pins the function region so all clients sync against the same
reference clock). Before going live:

1. Provision a Turso database (turso.tech) and set `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` in the
   Vercel project's environment variables.
2. Vercel runs `vercel-build` instead of `build` when it's present — it's set here to
   `drizzle-kit migrate && next build`, so schema migrations apply automatically on every deploy
   using those same env vars. No manual migration step needed.
3. Optional: provision an Ably app (ably.com), set `ABLY_API_KEY` and
   `NEXT_PUBLIC_REALTIME_ENABLED=true`. Without this the app runs on polling alone — fully
   functional, just up to ~2s of latency on cross-screen updates instead of near-instant.
   `NEXT_PUBLIC_*` vars are inlined at build time, so flipping this later requires a redeploy.
4. Optional: for sign-in, create a Google OAuth client with the redirect URI
   `https://<your-domain>/api/auth/callback/google` and set the three `AUTH_*` vars. For credits,
   also set `ADMIN_API_TOKEN` (shared with the panel) and the `PACHY_*` vars; leave
   `ENTITLEMENTS_ENFORCED` off until you've watched real traffic resolve correctly.

`.vercelignore` keeps `video/` out of deployments — only its rendered GIFs in `public/docs/` ship.

If you use Vercel preview deployments, point them at a separate Turso database (or at least be
aware `vercel-build` will run migrations against whatever DB the preview's env vars target).

## Not built yet

Count-up and time-of-day timer modes, a schedule-drift readout ("+2:12 behind schedule"), theming,
and self-serve checkout (credits are topped up by hand from the panel, by design for now).
