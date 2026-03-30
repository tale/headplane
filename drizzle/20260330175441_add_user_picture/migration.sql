ALTER TABLE `users` ADD `picture` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY,
	`sub` text NOT NULL UNIQUE,
	`name` text,
	`email` text,
	`picture` text,
	`role` text DEFAULT 'member' NOT NULL,
	`headscale_user_id` text UNIQUE,
	`created_at` integer,
	`updated_at` integer,
	`last_login_at` integer,
	`caps` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`(`id`, `sub`, `name`, `email`, `role`, `headscale_user_id`, `created_at`, `updated_at`, `last_login_at`, `caps`) SELECT `id`, `sub`, `name`, `email`, `role`, `headscale_user_id`, `created_at`, `updated_at`, `last_login_at`, `caps` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `users_sub_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `users_headscale_user_id_unique`;