ALTER TABLE `rooms` ADD `archived_at` integer;--> statement-breakpoint
CREATE INDEX `rooms_owner_active_idx` ON `rooms` (`owner_user_id`,`archived_at`);