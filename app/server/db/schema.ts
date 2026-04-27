import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  kind: text("kind").notNull(), // 'oidc' | 'api_key'
  user_id: text("user_id"),
  api_key_hash: text("api_key_hash"),
  api_key_display: text("api_key_display"),
  oidc_id_token: text("oidc_id_token"),
  expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
  created_at: integer("created_at", { mode: "timestamp" }).$default(() => new Date()),
});

export type AuthSessionRecord = typeof authSessions.$inferSelect;
export type AuthSessionInsert = typeof authSessions.$inferInsert;
