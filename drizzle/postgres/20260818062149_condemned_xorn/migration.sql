CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY,
	"kind" text NOT NULL,
	"user_id" text,
	"api_key_hash" text,
	"api_key_display" text,
	"oidc_id_token" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "host_info" (
	"host_id" text PRIMARY KEY,
	"payload" jsonb,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"sub" text NOT NULL UNIQUE,
	"name" text,
	"email" text,
	"picture" text,
	"role" text DEFAULT 'member' NOT NULL,
	"headscale_user_id" text UNIQUE,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"caps" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_single_owner" ON "users" ("role") WHERE "role" = 'owner';