import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { HostInfo } from '~/types';

export const ephemeralNodes = sqliteTable('ephemeral_nodes', {
	auth_key: text('auth_key').primaryKey(),
	node_key: text('node_key'),
});

export type EphemeralNode = typeof ephemeralNodes.$inferSelect;
export type EphemeralNodeInsert = typeof ephemeralNodes.$inferInsert;

export const hostInfo = sqliteTable('host_info', {
	host_id: text('host_id').primaryKey(),
	payload: text('payload', { mode: 'json' }).$type<HostInfo>(),
	updated_at: integer('updated_at', { mode: 'timestamp' }).$default(
		() => new Date(),
	),
});

export type HostInfoRecord = typeof hostInfo.$inferSelect;
export type HostInfoInsert = typeof hostInfo.$inferInsert;
