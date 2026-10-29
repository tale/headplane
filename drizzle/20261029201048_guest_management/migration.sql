CREATE TABLE `guests` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL,
	`display_name` text,
	`notes` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`requested_duration_seconds` integer,
	`requested_expires_at` integer,
	`activated_at` integer,
	`expires_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text,
	`revision` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "guests_phase_one_status" CHECK("status" IN ('draft', 'revoked')),
	CONSTRAINT "guests_no_activation" CHECK("activated_at" IS NULL AND "expires_at" IS NULL),
	CONSTRAINT "guests_requested_duration" CHECK(("requested_duration_seconds" IS NOT NULL AND "requested_duration_seconds" IN (86400, 172800, 604800)) OR ("requested_duration_seconds" IS NULL AND "requested_expires_at" IS NOT NULL)),
	CONSTRAINT "guests_revocation" CHECK(("status" = 'draft' AND "revoked_at" IS NULL) OR ("status" = 'revoked' AND "revoked_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `guests_email_idx` ON `guests` (`email`);--> statement-breakpoint
CREATE INDEX `guests_created_idx` ON `guests` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `guests_status_created_idx` ON `guests` (`status`,`created_at`,`id`);