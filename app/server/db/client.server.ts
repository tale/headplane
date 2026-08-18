import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as pgMigrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle as sqliteDrizzle } from "drizzle-orm/node-sqlite";
import type { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrate as sqliteMigrate } from "drizzle-orm/node-sqlite/migrator";
import { Pool } from "pg";

import log from "~/utils/log";

import type { HeadplaneConfig } from "../config/config-schema";
import { authSessions, hostInfo, users } from "./schema";
import type { HeadplaneUser } from "./schema";
import * as postgresSchema from "./schema.postgres";

export type HeadplaneDialect = "sqlite" | "postgres";

export interface SqliteTables {
  users: typeof users;
  authSessions: typeof authSessions;
  hostInfo: typeof hostInfo;
}

export interface PostgresTables {
  users: typeof postgresSchema.users;
  authSessions: typeof postgresSchema.authSessions;
  hostInfo: typeof postgresSchema.hostInfo;
}

/**
 * The tables Headplane queries. Typed as the SQLite schema for the same reason
 * as `HeadplaneClient`, with `AssertUserRowsMatch` below pinning the two
 * schemas to identical row shapes so the cast cannot silently drift.
 */
export type HeadplaneTables = SqliteTables;

/**
 * Queries throughout Headplane are typed against the SQLite client, and the
 * PostgreSQL client is cast to it once, in `createPostgresClient` below.
 *
 * This is not the shape I wanted. A union of the two client types is the
 * honest description, but TypeScript cannot call a method on a union of
 * generic signatures: every `.select()` and `.insert()` fails with "none of
 * those signatures are compatible with each other". The only union that
 * compiles is one containing `any`, which would erase type checking from every
 * query in the codebase — strictly worse than a single narrow cast.
 *
 * What makes the cast safe is not the type system but the contract test suite,
 * which runs the same query code against both engines. The API surface those
 * queries use — select/from/where/limit, insert/values, update/set, delete,
 * returning, onConflictDoUpdate — is identical on both dialects, and the tests
 * fail if that stops being true.
 *
 * Do not reach for a SQLite-only method (`.get()`, `.all()`, `.run()`) in
 * shared query code. It will typecheck and then fail against PostgreSQL.
 */
export type HeadplaneClient = NodeSQLiteDatabase;

/**
 * Compile-time proof that both dialects produce the same row shapes.
 *
 * Without this, a column that differs between the two schemas — a nullable
 * mismatch, a timestamp that infers to `string` instead of `Date` — would only
 * be discovered by running against that dialect.
 */
type Exact<A extends B, B extends C, C = A> = A;
export type AssertUserRowsMatch = Exact<typeof postgresSchema.users.$inferSelect, HeadplaneUser>;

/**
 * A database connection bundled with the schema and dialect it belongs to.
 *
 * `client` and `tables` are independent unions rather than a correlated pair:
 * TypeScript loses the correlation as soon as they are destructured, and the
 * query bodies are identical across dialects so there is nothing to gain from
 * narrowing. Pairing them correctly is the job of the factories below, which
 * are the only things that construct this.
 */
export interface HeadplaneDb {
  client: HeadplaneClient;
  tables: HeadplaneTables;
  dialect: HeadplaneDialect;

  /**
   * Releases the underlying handle: closes the SQLite file, or drains the
   * PostgreSQL pool. Nothing disposed the database before this existed.
   */
  dispose(): Promise<void>;
}

const sqliteTables: SqliteTables = { users, authSessions, hostInfo };
const postgresTables: PostgresTables = {
  users: postgresSchema.users,
  authSessions: postgresSchema.authSessions,
  hostInfo: postgresSchema.hostInfo,
};

export type DatabaseConfig =
  | { type: "sqlite"; path: string }
  | {
      type: "postgres";
      url: string;
      maxConnections: number;
      ssl: false | { rejectUnauthorized: boolean };
    };

/**
 * Masks the password in a connection string so it can be logged.
 *
 * A DSN carries a credential, and this is the only form that reaches the log.
 */
export function redactDsn(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    // Not parseable as a URL, so assume the worst rather than print it.
    return "<unparseable connection string>";
  }
}

function buildPostgresUrl(database: NonNullable<HeadplaneConfig["server"]["database"]>): string {
  if (database.url) {
    return database.url;
  }

  const { host, name, user, password, port } = database;
  if (!host || !name || !user) {
    throw new Error(
      "server.database requires either `url`, or all of `host`, `name` and `user`, when type is postgres",
    );
  }

  const url = new URL("postgres://placeholder");
  url.hostname = host;
  url.port = String(port ?? 5432);
  url.pathname = `/${name}`;
  url.username = user;
  if (password) {
    url.password = password;
  }

  return url.toString();
}

const SSL_MODES = {
  disable: false,
  // Encrypt, but do not verify the server certificate. This is what most
  // managed providers hand you out of the box.
  require: { rejectUnauthorized: false },
  "verify-full": { rejectUnauthorized: true },
} as const;

/**
 * Turns the optional `server.database` block into a concrete target.
 *
 * When the block is absent this reproduces the historical location exactly, so
 * an existing install keeps using the database it already has.
 */
export function resolveDatabaseConfig(server: HeadplaneConfig["server"]): DatabaseConfig {
  const database = server.database;

  if (database?.type === "postgres") {
    return {
      type: "postgres",
      url: buildPostgresUrl(database),
      maxConnections: database.max_connections ?? 10,
      ssl: SSL_MODES[database.ssl_mode ?? "require"],
    };
  }

  return {
    type: "sqlite",
    path: database?.path ?? join(server.data_path, "hp_persist.db"),
  };
}

export async function createDbClient(config: DatabaseConfig): Promise<HeadplaneDb> {
  if (config.type === "postgres") {
    return createPostgresClient(config);
  }

  return createSqliteClient(config.path);
}

async function createSqliteClient(path: string): Promise<HeadplaneDb> {
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

  const client = sqliteDrizzle(realPath);
  // The SQLite migrator is synchronous; the PostgreSQL one returns a promise.
  sqliteMigrate(client, { migrationsFolder: "./drizzle" });

  return wrapSqliteClient(client);
}

async function createPostgresClient(
  config: Extract<DatabaseConfig, { type: "postgres" }>,
): Promise<HeadplaneDb> {
  log.info("server", "Connecting to PostgreSQL at %s", redactDsn(config.url));

  const pool = new Pool({
    connectionString: config.url,
    max: config.maxConnections,
    ssl: config.ssl,
  });

  const client = pgDrizzle({ client: pool });

  try {
    await pgMigrate(client, { migrationsFolder: "./drizzle/postgres" });
  } catch (error) {
    // Drain the pool before rethrowing, otherwise a failed startup leaves
    // connections open and the process refuses to exit.
    await pool.end().catch(() => {});
    log.error(
      "server",
      "Failed to migrate the PostgreSQL database at %s: %s",
      redactDsn(config.url),
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }

  return {
    // The single cast described on `HeadplaneClient`. Verified by the
    // cross-dialect contract tests rather than by the compiler.
    client: client as unknown as HeadplaneClient,
    tables: postgresTables as unknown as HeadplaneTables,
    dialect: "postgres",
    dispose: async () => {
      try {
        await pool.end();
      } catch (error) {
        log.warn(
          "server",
          "Failed to close the PostgreSQL pool: %s",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };
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

/**
 * Wraps an already-constructed PostgreSQL client, for tests that manage their
 * own pool lifecycle.
 */
export function wrapPostgresClient(
  client: NodePgDatabase,
  dispose: () => Promise<void>,
): HeadplaneDb {
  return {
    client: client as unknown as HeadplaneClient,
    tables: postgresTables as unknown as HeadplaneTables,
    dialect: "postgres",
    dispose,
  };
}
