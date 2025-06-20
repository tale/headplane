import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const ephemeralNodes = sqliteTable('ephemeral_nodes', {
	auth_key: text('auth_key').primaryKey(),
	node_key: text('node_key'),
});

export type EphemeralNode = typeof ephemeralNodes.$inferSelect;
export type EphemeralNodeInsert = typeof ephemeralNodes.$inferInsert;
