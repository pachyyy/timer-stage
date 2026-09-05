import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'

/**
 * Rooms are the top-level share unit: one controller token (read/write) and one viewer token
 * (read-only) per room. No user accounts in v1 — see src/lib/auth/tokens.ts.
 */
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(), // short share code, e.g. "K3F9QZ"
  name: text('name').notNull(),
  controllerToken: text('controller_token').notNull(),
  viewerToken: text('viewer_token').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

/**
 * One row per timer in a room's agenda. `type` is a column (not a separate table) so adding
 * count-up / time-of-day modes later is additive.
 */
export const timers = sqliteTable('timers', {
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
})

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
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.roomId] })],
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

export type Room = typeof rooms.$inferSelect
export type NewRoom = typeof rooms.$inferInsert
export type Timer = typeof timers.$inferSelect
export type NewTimer = typeof timers.$inferInsert
export type RoomState = typeof roomState.$inferSelect
export type NewRoomState = typeof roomState.$inferInsert
export type Participant = typeof participants.$inferSelect
export type NewParticipant = typeof participants.$inferInsert
