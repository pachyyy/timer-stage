import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core'

/**
 * Rooms are the top-level share unit: one controller token (read/write) and one viewer token
 * (read-only) per room — the original, permanent, anonymous-friendly credentials, unchanged by
 * accounts. `ownerUserId` is purely additive: creating or claiming a room as a signed-in user
 * links it to that account for cross-device control and a cross-room "My Rooms" history view,
 * but the token paths above keep working exactly as before whether or not a room has an owner.
 */
export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(), // short share code, e.g. "K3F9QZ"
    name: text('name').notNull(),
    controllerToken: text('controller_token').notNull(),
    viewerToken: text('viewer_token').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    /** Null for anonymous rooms. `set null` on account deletion so removing an account never
     * destroys a live room mid-show — it just reverts to anonymous/token-only access. */
    ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Null = active. Set by the owner from /my-rooms (POST /api/rooms/[roomId]/archive). Purely
     * a declutter flag now — a room's credit is spent once, at creation (see accountQuota below),
     * so archiving doesn't free anything up or affect any limit. It predates the quota model,
     * back when it fed an active-room plan cap; kept for the /my-rooms "hide old rooms" UI. */
    archivedAt: integer('archived_at'),
  },
  (table) => [
    index('rooms_owner_idx').on(table.ownerUserId),
    index('rooms_owner_active_idx').on(table.ownerUserId, table.archivedAt),
  ],
)

/**
 * One row per timer in a room's agenda. `type` is a column (not a separate table) so adding
 * count-up / time-of-day modes later is additive.
 */
export const timers = sqliteTable(
  'timers',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    speaker: text('speaker'),
    notes: text('notes'),
    type: text('type', { enum: ['countdown'] }).notNull().default('countdown'),
    durationMs: integer('duration_ms').notNull(),
    wrapUpMs: integer('wrap_up_ms').notNull().default(60_000),
    /** Optional absolute wall-clock start this segment is scheduled for. Informational only — it
     * drives the ahead/behind-schedule readout, never an automatic start. */
    scheduledStartMs: integer('scheduled_start_ms'),
    /** When true, the moment THIS segment's countdown reaches 0:00 while running, the controller
     * auto-selects and auto-starts whatever segment is next BY POSITION at that instant — not a
     * fixed target id, so reordering/deleting the "next" segment just changes what this points at.
     * Purely a per-account UX convenience; no entitlements interaction. */
    linkToNext: integer('link_to_next', { mode: 'boolean' }).notNull().default(false),
  },
  // Every room-state load orders this exact (roomId, position) pair — see loadRoomStatePayload.
  (table) => [index('timers_room_position_idx').on(table.roomId, table.position)],
)

/**
 * Exactly one row per room: the live run-state anchor (see src/lib/timer/model.ts) plus the
 * monotonic `version` used to reject stale/out-of-order broadcasts. This row IS the realtime
 * broadcast payload (joined with `timers` for the agenda) — kept in its own table so bumping
 * the version and updating run state is a single atomic write.
 */
export const roomState = sqliteTable(
  'room_state',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(0),
    activeTimerId: text('active_timer_id'),
    status: text('status', { enum: ['stopped', 'running', 'paused'] })
      .notNull()
      .default('stopped'),
    startedAtMs: integer('started_at_ms'),
    elapsedBeforeMs: integer('elapsed_before_ms').notNull().default(0),
    blackout: integer('blackout', { mode: 'boolean' }).notNull().default(false),
    /** Controller-to-viewer cue text. Null when there's nothing to show. */
    message: text('message'),
    /** Server clock. Clients alert (vibrate/flash) only when this value *increases*. */
    messageSentAtMs: integer('message_sent_at_ms'),
    /** Absolute expiry; null means "until the controller clears it". Clients derive the hide
     * themselves by comparing against their synced clock — no server-side timer involved. */
    messageExpiresAtMs: integer('message_expires_at_ms'),
    /** The open run, or null when no show is in progress — see src/lib/db/run-log.ts. Deliberately
     * NOT a foreign key: it's written in the same statement as the version bump, and an FK would
     * force an insert-then-update ordering dance in openRun for no real benefit. */
    currentRunId: text('current_run_id'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.roomId] })],
)

/**
 * One row per show session ("run"). A run opens lazily on the first 'start' after the room has no
 * open run, and closes on an explicit "End show" (or, if the operator forgets, the next 'start'
 * more than STALE_RUN_MS later rolls it over — see src/lib/history/rollover.ts). The agenda
 * deliberately survives a run closing: the same show can be run again, producing a new run.
 */
export const runs = sqliteTable(
  'runs',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    /** 1-based, per room — what the History list labels "Run 3". */
    seq: integer('seq').notNull(),
    /** Snapshot of rooms.name when the run began, so a later rename doesn't relabel old runs. */
    label: text('label').notNull(),
    startedAtMs: integer('started_at_ms').notNull(),
    /** Null while the run is open. Set by "End show", or by the stale-run rollover. */
    endedAtMs: integer('ended_at_ms'),
    /** True when closed by rollover rather than an explicit End show — the report renders this as
     * "abandoned", since its final segment has no real end timestamp. */
    abandoned: integer('abandoned', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [index('runs_room_started_idx').on(table.roomId, table.startedAtMs)],
)

/**
 * Append-only log of every run-state transition, stamped with the SAME server nowMs that produced
 * the transition (see mutateRunState) — so the log and the live anchor state can never disagree.
 * `seq` is an autoincrement rowid: both the primary key and the causal tiebreaker for two events
 * landing in the same millisecond, at zero extra query cost.
 */
export const runEvents = sqliteTable(
  'run_events',
  {
    seq: integer('seq').primaryKey({ autoIncrement: true }),
    runId: text('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    atMs: integer('at_ms').notNull(),
    type: text('type', {
      enum: [
        'start',
        'resume',
        'pause',
        'reset',
        'select',
        'adjust',
        'blackout_on',
        'blackout_off',
        'message',
        'run_end',
      ],
    }).notNull(),
    /**
     * The segment that was ACTIVE at the instant of this event — i.e. the one `elapsedMs` and
     * `plannedDurationMs` below describe. For 'select' that's the OUTGOING segment; the incoming
     * one is `toTimerId`. Getting this backwards is the easiest subtle bug this log could have.
     */
    timerId: text('timer_id'),
    toTimerId: text('to_timer_id'),
    /** Snapshot of the active segment's name, so a later rename/delete can't rewrite history. */
    timerName: text('timer_name'),
    /** The active segment's configured durationMs at this instant. The report reads this off the
     * FIRST 'start'/'resume' for that segment in the run — that is what "planned" means when the
     * duration is edited mid-show. */
    plannedDurationMs: integer('planned_duration_ms'),
    scheduledStartMs: integer('scheduled_start_ms'),
    /** Total elapsed on `timerId` at the instant of the event, from the PRE-transition RunState. */
    elapsedMs: integer('elapsed_ms'),
    /** Signed delta for 'adjust'; null otherwise. */
    deltaMs: integer('delta_ms'),
    /** Free text: the message body for 'message'; null otherwise. */
    note: text('note'),
  },
  (table) => [index('run_events_run_seq_idx').on(table.runId, table.seq)],
)

/**
 * A named viewer who joined the room (via the direct link or the "join with code" flow — both
 * funnel through the same join step, see /api/rooms/[roomId]/participants). `sessionToken` is a
 * private bearer credential held only by that participant's browser (localStorage), distinct
 * from the room-wide controller/viewer tokens above.
 *
 * `role` starts at 'viewer' and can be promoted to 'controller' by whoever holds the room's
 * controllerToken — see checkRoomAccess, which treats a participant's sessionToken as an
 * equally-valid controller credential once promoted. This is what lets the admin grant control
 * to a specific joined person without a second room-wide secret.
 */
export const participants = sqliteTable('participants', {
  id: text('id').primaryKey(),
  roomId: text('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sessionToken: text('session_token').notNull(),
  role: text('role', { enum: ['viewer', 'controller'] })
    .notNull()
    .default('viewer'),
  joinedAt: integer('joined_at').notNull(),
})

/**
 * The four tables below are Auth.js's own expected shape for `@auth/drizzle-adapter`'s SQLite
 * adapter (table/column names and types hand-matched against its `DefaultSQLiteSchema` type, not
 * imported from the adapter itself — this keeps drizzle-kit's schema introspection free of any
 * adapter runtime code). Naming intentionally follows Auth.js's own camelCase/singular convention
 * rather than this file's snake_case-table plural style — matching the adapter's expectations
 * exactly here is worth more than internal consistency, since a self-invented column map is one
 * more thing to keep in sync and debug. See src/auth.ts for how these wire into NextAuth().
 */
export const users = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),
})

export const accounts = sqliteTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
)

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
})

export const verificationTokens = sqliteTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
)

/**
 * The quota/wallet model (see src/lib/db/quota.ts and src/lib/entitlements/gate.ts): one row per
 * signed-in account, the live spendable balance. Created lazily on first touch with a starter
 * balance — there's no separate "sign up" step to hook. Lives HERE (stagetimer's own DB), not in
 * the shared pachy-core control-plane DB, deliberately: consuming a unit has to happen atomically
 * with the room/participant row it's paying for, which only works if the counter and that row
 * share a database and a single conditional UPDATE. The panel tops this up by calling stagetimer's
 * own admin API (see src/app/api/admin/v1/quota/route.ts), not by writing here directly.
 */
export const accountQuota = sqliteTable('account_quota', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  roomQuota: integer('room_quota').notNull().default(0),
  userQuota: integer('user_quota').notNull().default(0),
  /** Chorus (audience Q&A) session credits — priced separately from rooms. One credit = one
   * session = one presentation; see canCreateChorus. */
  chorusQuota: integer('chorus_quota').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
})

/**
 * Append-only. Every grant (an admin topping up a balance) and every consumption (a room created,
 * a participant joined beyond the free 3) writes one row here — same "why is the number what it
 * is" rationale as the panel's own audit_log. `roomId` is set for a consumption tied to a specific
 * room; null for a grant (which isn't about any one room) or for the room-creation consumption
 * itself (the room doesn't exist yet at the instant its own credit is spent — see canCreateRoom).
 */
export const quotaLedger = sqliteTable(
  'quota_ledger',
  {
    seq: integer('seq').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    atMs: integer('at_ms').notNull(),
    kind: text('kind', {
      enum: ['room_grant', 'user_grant', 'room_consume', 'user_consume', 'chorus_grant', 'chorus_consume'],
    }).notNull(),
    /** Positive for a grant, negative for a consumption. */
    delta: integer('delta').notNull(),
    roomId: text('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    /** Same idea as `roomId`, for a Chorus credit. A separate column because `roomId` is an FK to
     * `rooms`. Null for the creation consumption itself, same reason as rooms (see canCreateChorus). */
    chorusSessionId: text('chorus_session_id').references(() => chorusSessions.id, { onDelete: 'set null' }),
    note: text('note'),
  },
  (table) => [index('quota_ledger_user_idx').on(table.userId)],
)

/**
 * Chorus: live audience Q&A (see src/lib/chorus/). A session is its own share unit, separate from
 * `rooms` — it's priced separately, can exist without any timer room, and is joined by a 6-digit
 * NUMERIC code (`id`), which is what lets one join box tell the two apart (room codes always
 * contain a letter — see generateRoomId). `controllerToken` runs it; `presenterToken` is the
 * read-only credential for the presenter window, which unlike the public audience view gets to
 * see answers. `linkedRoomId` shows it as a card on that room's control page, and lets that room's
 * controllers run it too — see checkChorusAccess.
 */
export const chorusSessions = sqliteTable(
  'chorus_sessions',
  {
    id: text('id').primaryKey(), // 6-digit numeric join code, e.g. "482913"
    name: text('name').notNull(),
    controllerToken: text('controller_token').notNull(),
    presenterToken: text('presenter_token').notNull(),
    /** 'answers': the host's prepared prompts, answered by the audience. 'qna': the audience asks
     * and votes, the host highlights one. Fixed at creation; both cost one Chorus credit. */
    mode: text('mode', { enum: ['answers', 'qna'] })
      .notNull()
      .default('answers'),
    ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    linkedRoomId: text('linked_room_id').references(() => rooms.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    archivedAt: integer('archived_at'),
  },
  (table) => [
    index('chorus_sessions_owner_idx').on(table.ownerUserId),
    index('chorus_sessions_room_idx').on(table.linkedRoomId),
  ],
)

/** The host's prepared, open-text questions, presented one at a time in `position` order. */
export const chorusQuestions = sqliteTable(
  'chorus_questions',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => chorusSessions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    prompt: text('prompt').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('chorus_questions_session_position_idx').on(table.sessionId, table.position)],
)

/**
 * One row per session, mirroring `room_state`: the presentation state plus the monotonic `version`
 * every client's version guard checks. `answersVersion` is a SEPARATE counter, bumped on every new
 * or hidden answer — answers never ride the broadcast channel (only the presenter and control
 * windows poll for them), so a new answer must not bump `version` and make every phone refetch.
 * 'ended' is terminal: one credit pays for one presentation.
 */
export const chorusState = sqliteTable(
  'chorus_state',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => chorusSessions.id, { onDelete: 'cascade' }),
    version: integer('version').notNull().default(0),
    status: text('status', { enum: ['draft', 'live', 'ended'] })
      .notNull()
      .default('draft'),
    /** What's on the big screen: the current prompt ('answers' mode) or the host's highlighted
     * audience question ('qna' mode). */
    currentQuestionId: text('current_question_id'),
    /** Presenter-window text size, as a percentage of the base size: the answers in 'answers' mode,
     * the highlighted question in 'qna' mode. Prompts aren't scaled. */
    answerFontPercent: integer('answer_font_percent').notNull().default(100),
    presentedAtMs: integer('presented_at_ms'),
    endedAtMs: integer('ended_at_ms'),
    answersVersion: integer('answers_version').notNull().default(0),
    /** 'qna' only: the same idea as `answersVersion` for the audience question list. A new question,
     * vote, hide or answered-mark bumps this and never `version`, so a vote doesn't make every phone
     * refetch the state payload. */
    feedVersion: integer('feed_version').notNull().default(0),
    /** 'qna' only: false = the host paused new questions (voting continues). */
    intakeOpen: integer('intake_open', { mode: 'boolean' }).notNull().default(true),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId] })],
)

/**
 * Anonymous audience answers. Never deleted — hiding sets `hiddenAt`, which only keeps it off the
 * presenter window. `deviceKey` (a random id from the phone's localStorage) and `ipHash` (sha256 of
 * ip + session id, never the raw IP) exist only for rate limiting — see src/lib/chorus/rate-limit.ts.
 */
export const chorusAnswers = sqliteTable(
  'chorus_answers',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => chorusSessions.id, { onDelete: 'cascade' }),
    questionId: text('question_id')
      .notNull()
      .references(() => chorusQuestions.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
    hiddenAt: integer('hidden_at'),
    deviceKey: text('device_key').notNull(),
    ipHash: text('ip_hash').notNull(),
  },
  (table) => [
    index('chorus_answers_question_idx').on(table.sessionId, table.questionId, table.createdAtMs),
    index('chorus_answers_ip_idx').on(table.sessionId, table.ipHash, table.createdAtMs),
    index('chorus_answers_device_idx').on(table.sessionId, table.deviceKey, table.createdAtMs),
  ],
)

/**
 * 'qna' mode: questions typed by the audience. Never deleted — hiding sets `hiddenAt` (off every
 * phone and the presenter), answering sets `answeredAt` (a host's "done" marker). `deviceKey` /
 * `ipHash` exist only for rate limiting, same as `chorus_answers`.
 */
export const chorusQnaQuestions = sqliteTable(
  'chorus_qna_questions',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => chorusSessions.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
    hiddenAt: integer('hidden_at'),
    answeredAt: integer('answered_at'),
    deviceKey: text('device_key').notNull(),
    ipHash: text('ip_hash').notNull(),
  },
  (table) => [
    index('chorus_qna_questions_session_idx').on(table.sessionId, table.createdAtMs),
    index('chorus_qna_questions_ip_idx').on(table.sessionId, table.ipHash, table.createdAtMs),
    index('chorus_qna_questions_device_idx').on(table.sessionId, table.deviceKey, table.createdAtMs),
  ],
)

/**
 * One up-vote per device per question — the composite primary key is what makes a double tap or a
 * replayed request a no-op. Counts are computed with a COUNT, never stored, so they can't drift.
 */
export const chorusQnaVotes = sqliteTable(
  'chorus_qna_votes',
  {
    questionId: text('question_id')
      .notNull()
      .references(() => chorusQnaQuestions.id, { onDelete: 'cascade' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => chorusSessions.id, { onDelete: 'cascade' }),
    deviceKey: text('device_key').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.questionId, table.deviceKey] }),
    index('chorus_qna_votes_device_idx').on(table.sessionId, table.deviceKey, table.createdAtMs),
  ],
)

export type Room = typeof rooms.$inferSelect
export type NewRoom = typeof rooms.$inferInsert
export type Timer = typeof timers.$inferSelect
export type NewTimer = typeof timers.$inferInsert
export type RoomState = typeof roomState.$inferSelect
export type NewRoomState = typeof roomState.$inferInsert
export type Participant = typeof participants.$inferSelect
export type NewParticipant = typeof participants.$inferInsert
export type Run = typeof runs.$inferSelect
export type NewRun = typeof runs.$inferInsert
export type RunEvent = typeof runEvents.$inferSelect
export type NewRunEvent = typeof runEvents.$inferInsert
export type User = typeof users.$inferSelect
export type AccountQuota = typeof accountQuota.$inferSelect
export type QuotaLedgerEntry = typeof quotaLedger.$inferSelect
export type ChorusSession = typeof chorusSessions.$inferSelect
export type ChorusQuestion = typeof chorusQuestions.$inferSelect
export type ChorusStateRow = typeof chorusState.$inferSelect
export type ChorusAnswer = typeof chorusAnswers.$inferSelect
