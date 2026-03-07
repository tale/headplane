CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`user_id` text,
	`api_key_hash` text,
	`api_key_display` text,
	`expires_at` integer NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `headscale_user_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `created_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` integer;--> statement-breakpoint

-- Backfill role from caps for existing users
UPDATE `users` SET `role` = 'owner' WHERE `caps` = 65535;--> statement-breakpoint
UPDATE `users` SET `role` = 'admin' WHERE `caps` = 32767;--> statement-breakpoint
UPDATE `users` SET `role` = 'network_admin' WHERE `caps` = 30015;--> statement-breakpoint
UPDATE `users` SET `role` = 'it_admin' WHERE `caps` = 8171;--> statement-breakpoint
UPDATE `users` SET `role` = 'auditor' WHERE `caps` = 66859;