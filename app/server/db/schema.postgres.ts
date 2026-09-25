import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { HostInfo } from "~/types";

// The PostgreSQL mirror of `schema.ts`. Column names and semantics must match
// it exactly — `HeadplaneTables` in `client.server.ts` pins the two together at
// compile time, so a drift in inferred row types fails the build rather than
// surfacing as a runtime shape difference on one dialect only.
//
// Type choices worth noting:
//   - `timestamp(..., { withTimezone: true })` rather than SQLite's integer
//     epoch. Both infer to `Date`.
//   - `jsonb` rather than `text({ mode: "json" })`. Both infer to the payload
//     type; jsonb is parsed by the server instead of round-tripped as a string.

export const hostInfo = pgTable("host_info", {
  host_id: text("host_id").primaryKey(),
  payload: jsonb("payload").$type<HostInfo>(),
  updated_at: timestamp("updated_at", { withTimezone: true }).$default(() => new Date()),
});

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    sub: text("sub").notNull().unique(),
    name: text("name"),
    email: text("email"),
    picture: text("picture"),
    role: text("role").notNull().default("member"),
    headscale_user_id: text("headscale_user_id").unique(),
    created_at: timestamp("created_at", { withTimezone: true }).$default(() => new Date()),
    updated_at: timestamp("updated_at", { withTimezone: true }).$default(() => new Date()),
    last_login_at: timestamp("last_login_at", { withTimezone: true }),

    // Deprecated: kept for migration compatibility, will be removed in 1.0
    caps: integer("caps").notNull().default(0),
  },
  (table) => [
    // Enforces at most one owner at the database level.
    //
    // The owner bootstrap guard in `findOrCreateUser` is a single conditional
    // UPDATE, which is atomic under SQLite's serialized writes. It is not under
    // PostgreSQL READ COMMITTED: two concurrent first logins update different
    // rows, so they take no conflicting row locks, both evaluate the
    // `NOT EXISTS` against a pre-promotion snapshot, and both commit.
    //
    // This index is the actual guarantee on PostgreSQL. It is safe to create
    // unconditionally because PostgreSQL support is new — there is no existing
    // database that could already hold two owners.
    uniqueIndex("users_single_owner")
      .on(table.role)
      .where(sql`${table.role} = 'owner'`),
  ],
);

export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // 'oidc' | 'api_key' (proxy auth is request-scoped)
  user_id: text("user_id"),
  api_key_hash: text("api_key_hash"),
  api_key_display: text("api_key_display"),
  oidc_id_token: text("oidc_id_token"),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).$default(() => new Date()),
});
