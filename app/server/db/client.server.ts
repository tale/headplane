import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { drizzle } from 'drizzle-orm/libsql/sqlite3';
import log from '~/utils/log';

export async function createDbClient(path: string) {
	const realPath = resolve(path);
	try {
		await mkdir(dirname(realPath), { recursive: true });
	} catch (error) {
		log.error(
			'server',
			'Failed to create directory for database at %s: %s',
			realPath,
			error instanceof Error ? error.message : String(error),
		);
		throw new Error(`Could not create directory for database at ${realPath}`);
	}

	// Turn the path into a URL with the file protocol
	const db = drizzle(`file://${realPath}`);
	migrate(db, {
		migrationsFolder: './drizzle',
	});

	return db;
}
