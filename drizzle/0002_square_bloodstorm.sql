CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`sub` text NOT NULL,
	`caps` integer DEFAULT 0 NOT NULL,
	`onboarded` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_sub_unique` ON `users` (`sub`);
