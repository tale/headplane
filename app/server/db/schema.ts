import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { HostInfo } from "~/types";

export const hostInfo = sqliteTable("host_info", {
  host_id: text("host_id").primaryKey(),
  payload: text("payload", { mode: "json" }).$type<HostInfo>(),
  updated_at: integer("updated_at", { mode: "timestamp" }).$default(() => new Date()),
});

export type HostInfoRecord = typeof hostInfo.$inferSelect;
export type HostInfoInsert = typeof hostInfo.$inferInsert;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  sub: text("sub").notNull().unique(),
  name: text("name"),
  email: text("email"),
  picture: text("picture"),
  role: text("role").notNull().default("member"),
  headscale_user_id: text("headscale_user_id").unique(),
  created_at: integer("created_at", { mode: "timestamp" }).$default(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" }).$default(() => new Date()),
  last_login_at: integer("last_login_at", { mode: "timestamp" }),

  // Deprecated: kept for migration compatibility, will be removed in 1.0
  caps: integer("caps").notNull().default(0),
});

export type HeadplaneUser = typeof users.$inferSelect;
export type HeadplaneUserInsert = typeof users.$inferInsert;

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // 'oidc' | 'api_key' (proxy auth is request-scoped)
  user_id: text("user_id"),
  api_key_hash: text("api_key_hash"),
  api_key_display: text("api_key_display"),
  oidc_id_token: text("oidc_id_token"),
  expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
  created_at: integer("created_at", { mode: "timestamp" }).$default(() => new Date()),
});

export type AuthSessionRecord = typeof authSessions.$inferSelect;
export type AuthSessionInsert = typeof authSessions.$inferInsert;

export const guests = sqliteTable(
  "guests",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    display_name: text("display_name"),
    notes: text("notes"),
    status: text("status", { enum: ["draft", "pending", "active", "expired", "revoked"] })
      .notNull()
      .default("draft"),
    requested_duration_seconds: integer("requested_duration_seconds"),
    requested_expires_at: integer("requested_expires_at", { mode: "timestamp" }),
    activated_at: integer("activated_at", { mode: "timestamp" }),
    expires_at: integer("expires_at", { mode: "timestamp" }),
    revoked_at: integer("revoked_at", { mode: "timestamp" }),
    created_at: integer("created_at", { mode: "timestamp" }).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).notNull(),
    // Historical attribution, retained even if the account is later removed.
    // API key sessions have no local user ID and leave this null.
    created_by: text("created_by"),
    revision: integer("revision").notNull().default(1),
  },
  (table) => [
    index("guests_email_idx").on(table.email),
    index("guests_created_idx").on(table.created_at, table.id),
    index("guests_status_created_idx").on(table.status, table.created_at, table.id),
    // Phase 1 never represents a draft as provisioned network access.
    check("guests_phase_one_status", sql`${table.status} IN ('draft', 'revoked')`),
    check(
      "guests_no_activation",
      sql`${table.activated_at} IS NULL AND ${table.expires_at} IS NULL`,
    ),
    check(
      "guests_requested_duration",
      sql`(${table.requested_duration_seconds} IS NOT NULL AND ${table.requested_duration_seconds} IN (86400, 172800, 604800)) OR (${table.requested_duration_seconds} IS NULL AND ${table.requested_expires_at} IS NOT NULL)`,
    ),
    check(
      "guests_revocation",
      sql`(${table.status} = 'draft' AND ${table.revoked_at} IS NULL) OR (${table.status} = 'revoked' AND ${table.revoked_at} IS NOT NULL)`,
    ),
  ],
);

export type Guest = typeof guests.$inferSelect;
