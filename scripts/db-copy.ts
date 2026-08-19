// MARK: SQLite → PostgreSQL copy
//
// Moves an existing Headplane database onto PostgreSQL. Without this,
// switching `server.database.type` gives you an empty instance: every user is
// recreated on next sign-in with the default role, and whoever signs in first
// becomes the owner.
//
//   pnpm exec tsx scripts/db-copy.ts \
//     --from /var/lib/headplane/hp_persist.db \
//     --to postgres://headplane@10.0.0.5:5432/headplane
//
// Stop Headplane before running this. Copying from a live database can capture
// a half-written state.

import { exit } from "node:process";

import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { migrate as pgMigrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle as sqliteDrizzle } from "drizzle-orm/node-sqlite";
import { Pool } from "pg";

import { redactDsn } from "~/server/db/client.server";
import * as sqlite from "~/server/db/schema";
import * as pg from "~/server/db/schema.postgres";

export interface CopyOptions {
  from: string;
  to: string;
  /** Report what would be copied without writing anything. */
  dryRun?: boolean;
  /** Permit copying into a target that already holds rows. */
  allowNonEmpty?: boolean;
  log?: (message: string) => void;
}

export interface CopyResult {
  users: number;
  authSessions: number;
  hostInfo: number;
  skippedExpiredSessions: number;
}

const BATCH_SIZE = 500;

async function insertInBatches<T>(
  rows: T[],
  insert: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    await insert(rows.slice(index, index + BATCH_SIZE));
  }
}

export async function copyDatabase(options: CopyOptions): Promise<CopyResult> {
  const log = options.log ?? ((message: string) => console.log(message));

  const source = sqliteDrizzle(options.from);
  const pool = new Pool({ connectionString: options.to });
  const target = pgDrizzle({ client: pool });

  try {
    // The target may be brand new, so make sure its tables exist before
    // reading anything from the source.
    await pgMigrate(target, { migrationsFolder: "./drizzle/postgres" });

    const users = await source.select().from(sqlite.users);
    const sessions = await source.select().from(sqlite.authSessions);
    const hosts = await source.select().from(sqlite.hostInfo);

    // Headplane briefly had a race where concurrent first logins could leave
    // an instance with no owner, and a hand-repaired database can end up with
    // two. PostgreSQL enforces at most one via a partial unique index, so
    // catch it here where the message can be useful rather than letting the
    // insert fail with a constraint violation.
    const owners = users.filter((user) => user.role === "owner");
    if (owners.length > 1) {
      throw new Error(
        `Source database has ${owners.length} owners (${owners
          .map((owner) => owner.sub)
          .join(", ")}). PostgreSQL permits only one — demote all but one before copying.`,
      );
    }

    const now = new Date();
    const liveSessions = sessions.filter((session) => session.expires_at > now);
    const skippedExpiredSessions = sessions.length - liveSessions.length;

    const result: CopyResult = {
      users: users.length,
      authSessions: liveSessions.length,
      hostInfo: hosts.length,
      skippedExpiredSessions,
    };

    if (!options.allowNonEmpty) {
      const [existing] = await target.select({ id: pg.users.id }).from(pg.users).limit(1);
      if (existing) {
        throw new Error(
          "Target database already contains users. Re-run with --allow-nonempty if you intend to merge into it.",
        );
      }
    }

    if (options.dryRun) {
      log(
        `Would copy ${result.users} users, ${result.authSessions} sessions and ${result.hostInfo} host records`,
      );
      return result;
    }

    // Users first: sessions carry a user_id that is meaningless without them.
    await insertInBatches(users, (batch) => target.insert(pg.users).values(batch));
    await insertInBatches(liveSessions, (batch) => target.insert(pg.authSessions).values(batch));
    await insertInBatches(hosts, (batch) => target.insert(pg.hostInfo).values(batch));

    log(
      `Copied ${result.users} users, ${result.authSessions} sessions and ${result.hostInfo} host records`,
    );
    if (skippedExpiredSessions > 0) {
      log(`Skipped ${skippedExpiredSessions} expired sessions`);
    }

    return result;
  } finally {
    await pool.end().catch(() => {});
    (source as unknown as { $client?: { close?: () => void } }).$client?.close?.();
  }
}

function parseArgs(argv: string[]): CopyOptions {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, true);
    }
  }

  const from = args.get("from");
  const to = args.get("to");
  if (typeof from !== "string" || typeof to !== "string") {
    throw new Error(
      "Usage: tsx scripts/db-copy.ts --from <sqlite-path> --to <postgres-url> [--dry-run] [--allow-nonempty]",
    );
  }

  return {
    from,
    to,
    dryRun: args.get("dry-run") === true,
    allowNonEmpty: args.get("allow-nonempty") === true,
  };
}

// Only runs when invoked directly, so the copy can be imported by tests.
if (process.argv[1]?.endsWith("db-copy.ts")) {
  try {
    const options = parseArgs(process.argv.slice(2));
    console.log(`Copying ${options.from} → ${redactDsn(options.to)}`);
    await copyDatabase(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    exit(1);
  }
}
