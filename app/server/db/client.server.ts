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

/**
 * Closes the underlying database handle.
 *
 * Nothing called this before, so a graceful shutdown left the SQLite handle
 * open and its journal un-finalized. Registered as a disposer in the app
 * context so shutdown releases it explicitly.
 */
export function closeDbClient(db: Awaited<ReturnType<typeof createDbClient>>): void {
  const client = (db as unknown as { $client?: { close?: () => void } }).$client;

  try {
    client?.close?.();
  } catch (error) {
    log.warn(
      "server",
      "Failed to close the database handle: %s",
      error instanceof Error ? error.message : String(error),
    );
  }
}
