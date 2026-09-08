CREATE TABLE `account_quota` (
	`user_id` text PRIMARY KEY NOT NULL,
	`room_quota` integer DEFAULT 0 NOT NULL,
	`user_quota` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quota_ledger` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`at_ms` integer NOT NULL,
	`kind` text NOT NULL,
	`delta` integer NOT NULL,
	`room_id` text,
	`note` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `quota_ledger_user_idx` ON `quota_ledger` (`user_id`);