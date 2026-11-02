CREATE TABLE `chorus_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	`hidden_at` integer,
	`device_key` text NOT NULL,
	`ip_hash` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chorus_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `chorus_questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chorus_answers_question_idx` ON `chorus_answers` (`session_id`,`question_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `chorus_answers_ip_idx` ON `chorus_answers` (`session_id`,`ip_hash`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `chorus_answers_device_idx` ON `chorus_answers` (`session_id`,`device_key`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `chorus_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`position` integer NOT NULL,
	`prompt` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chorus_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chorus_questions_session_position_idx` ON `chorus_questions` (`session_id`,`position`);--> statement-breakpoint
CREATE TABLE `chorus_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`controller_token` text NOT NULL,
	`presenter_token` text NOT NULL,
	`owner_user_id` text,
	`linked_room_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`linked_room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `chorus_sessions_owner_idx` ON `chorus_sessions` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `chorus_sessions_room_idx` ON `chorus_sessions` (`linked_room_id`);--> statement-breakpoint
CREATE TABLE `chorus_state` (
	`session_id` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_question_id` text,
	`answer_font_percent` integer DEFAULT 100 NOT NULL,
	`presented_at_ms` integer,
	`ended_at_ms` integer,
	`answers_version` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chorus_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `account_quota` ADD `chorus_quota` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `quota_ledger` ADD `chorus_session_id` text REFERENCES chorus_sessions(id);