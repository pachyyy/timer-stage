CREATE TABLE `run_events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`at_ms` integer NOT NULL,
	`type` text NOT NULL,
	`timer_id` text,
	`to_timer_id` text,
	`timer_name` text,
	`planned_duration_ms` integer,
	`scheduled_start_ms` integer,
	`elapsed_ms` integer,
	`delta_ms` integer,
	`note` text,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `run_events_run_seq_idx` ON `run_events` (`run_id`,`seq`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`seq` integer NOT NULL,
	`label` text NOT NULL,
	`started_at_ms` integer NOT NULL,
	`ended_at_ms` integer,
	`abandoned` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `runs_room_started_idx` ON `runs` (`room_id`,`started_at_ms`);--> statement-breakpoint
ALTER TABLE `room_state` ADD `current_run_id` text;