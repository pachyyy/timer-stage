CREATE TABLE `chorus_qna_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	`hidden_at` integer,
	`answered_at` integer,
	`device_key` text NOT NULL,
	`ip_hash` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chorus_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chorus_qna_questions_session_idx` ON `chorus_qna_questions` (`session_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `chorus_qna_questions_ip_idx` ON `chorus_qna_questions` (`session_id`,`ip_hash`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `chorus_qna_questions_device_idx` ON `chorus_qna_questions` (`session_id`,`device_key`,`created_at_ms`);--> statement-breakpoint
CREATE TABLE `chorus_qna_votes` (
	`question_id` text NOT NULL,
	`session_id` text NOT NULL,
	`device_key` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	PRIMARY KEY(`question_id`, `device_key`),
	FOREIGN KEY (`question_id`) REFERENCES `chorus_qna_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `chorus_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chorus_qna_votes_device_idx` ON `chorus_qna_votes` (`session_id`,`device_key`,`created_at_ms`);--> statement-breakpoint
ALTER TABLE `chorus_sessions` ADD `mode` text DEFAULT 'answers' NOT NULL;--> statement-breakpoint
ALTER TABLE `chorus_state` ADD `feed_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `chorus_state` ADD `intake_open` integer DEFAULT true NOT NULL;