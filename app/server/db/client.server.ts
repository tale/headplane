import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { drizzle } from "drizzle-orm/node-sqlite";
import type { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

import log from "~/utils/log";

import { authSessions, hostInfo, users } from "./schema";

export type HeadplaneDialect = "sqlite";

/**
 * The tables Headplane queries.
 *
 * Callers reach tables through this rather than importing the schema module
 * directly, so the schema travels with the connection that can execute it
 * instead of being fixed at import time.
 */
export interface HeadplaneTables {
  users: typeof users;
  authSessions: typeof authSessions;
  hostInfo: typeof hostInfo;
}

/**
 * A database connection bundled with the schema and dialect it belongs to.
 */
export interface HeadplaneDb {
  client: NodeSQLiteDatabase;
  tables: HeadplaneTables;
  dialect: HeadplaneDialect;

  /**
   * Releases the underlying handle. Nothing disposed the database before, so
   * a graceful shutdown left the SQLite handle open with its journal
   * un-finalized.
   */
  dispose(): Promise<void>;
}

const sqliteTables: HeadplaneTables = { users, authSessions, hostInfo };

export async function createDbClient(path: string): Promise<HeadplaneDb> {
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

  const client = drizzle(realPath);
  migrate(client, {
    migrationsFolder: "./drizzle",
  });

  return wrapSqliteClient(client);
}

/**
 * Wraps an already-constructed drizzle client. Shared with the test helpers,
 * which build in-memory databases without touching the filesystem.
 */
export function wrapSqliteClient(client: NodeSQLiteDatabase): HeadplaneDb {
  return {
    client,
    tables: sqliteTables,
    dialect: "sqlite",
    dispose: async () => {
      const handle = (client as unknown as { $client?: { close?: () => void } }).$client;

      try {
        handle?.close?.();
      } catch (error) {
        log.warn(
          "server",
          "Failed to close the database handle: %s",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };
}
