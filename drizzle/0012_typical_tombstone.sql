ALTER TABLE `participants` ADD `ip_hash` text;--> statement-breakpoint
CREATE INDEX `participants_room_idx` ON `participants` (`room_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_session_token_idx` ON `participants` (`session_token`);--> statement-breakpoint
CREATE INDEX `participants_room_ip_idx` ON `participants` (`room_id`,`ip_hash`,`joined_at`);