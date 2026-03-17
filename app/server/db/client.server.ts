import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

import log from "~/utils/log";

export async function createDbClient(path: string) {
  const realPath = resolve(path);
  try {
    await mkdir(dirname(realPath), { recursive: true });
  } catch (error) {
    log.error(
      "server",
      "Failed to create directory for database at %s: %s",
      realPath,
      error instanceof Error ? error.message : String(error),
    );
    throw new Error(`Could not create directory for database at ${realPath}`);
  }

  const db = drizzle(realPath);
  migrate(db, {
    migrationsFolder: "./drizzle",
  });

  return db;
}
