import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import log from '~/utils/log';

export async function createDbClient(path: string) {
	try {
		await mkdir(dirname(path), { recursive: true });
	} catch (error) {
		log.error(
			'server',
			'Failed to create directory for database at %s: %s',
			path,
			error instanceof Error ? error.message : String(error),
		);
		throw new Error(`Could not create directory for database at ${path}`);
	}

	const db = drizzle(path);
	migrate(db, {
		migrationsFolder: './drizzle',
	});

	return db;
}
