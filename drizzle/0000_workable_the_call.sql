CREATE TABLE `room_state` (
	`room_id` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`active_timer_id` text,
	`status` text DEFAULT 'stopped' NOT NULL,
	`started_at_ms` integer,
	`elapsed_before_ms` integer DEFAULT 0 NOT NULL,
	`blackout` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`controller_token` text NOT NULL,
	`viewer_token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timers` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`speaker` text,
	`notes` text,
	`type` text DEFAULT 'countdown' NOT NULL,
	`duration_ms` integer NOT NULL,
	`wrap_up_ms` integer DEFAULT 60000 NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
