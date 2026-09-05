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

export type Room = typeof rooms.$inferSelect
export type NewRoom = typeof rooms.$inferInsert
export type Timer = typeof timers.$inferSelect
export type NewTimer = typeof timers.$inferInsert
export type RoomState = typeof roomState.$inferSelect
export type NewRoomState = typeof roomState.$inferInsert
