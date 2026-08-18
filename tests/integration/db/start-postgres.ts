import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer } from "testcontainers";

import { type HeadplaneDb, wrapPostgresClient } from "~/server/db/client.server";

export interface PostgresEnv {
  db: HeadplaneDb;
  /** Truncates every table so each test starts from a clean slate. */
  reset(): Promise<void>;
  stop(): Promise<void>;
}

export async function startPostgres(): Promise<PostgresEnv> {
  const container: StartedTestContainer = await new GenericContainer("postgres:17-alpine")
    .withEnvironment({
      POSTGRES_USER: "headplane",
      POSTGRES_PASSWORD: "headplane",
      POSTGRES_DB: "headplane",
    })
    .withExposedPorts(5432)
    .start();

  const url = `postgres://headplane:headplane@${container.getHost()}:${container.getMappedPort(5432)}/headplane`;

  // Postgres accepts connections a moment before it is ready for queries.
  let pool: Pool | undefined;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    pool = new Pool({ connectionString: url, max: 5 });
    try {
      await pool.query("select 1");
      break;
    } catch {
      await pool.end().catch(() => {});
      pool = undefined;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  if (!pool) {
    await container.stop();
    throw new Error("PostgreSQL did not become ready");
  }

  const client = drizzle({ client: pool });
  await migrate(client, { migrationsFolder: "./drizzle/postgres" });

  const readyPool = pool;
  return {
    db: wrapPostgresClient(client, async () => {
      await readyPool.end();
    }),
    reset: async () => {
      await readyPool.query("truncate table users, auth_sessions, host_info");
    },
    stop: async () => {
      await readyPool.end().catch(() => {});
      await container.stop();
    },
  };
}
