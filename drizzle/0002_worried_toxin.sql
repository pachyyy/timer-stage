ALTER TABLE `room_state` ADD `message` text;--> statement-breakpoint
ALTER TABLE `room_state` ADD `message_sent_at_ms` integer;--> statement-breakpoint
ALTER TABLE `room_state` ADD `message_expires_at_ms` integer;