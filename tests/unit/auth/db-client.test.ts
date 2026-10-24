import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { describe, expect, test, vi } from "vitest";

import { wrapSqliteClient } from "~/server/db/client.server";

vi.mock("~/utils/log", () => ({
  default: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

function createDb() {
  const client = drizzle(":memory:");
  migrate(client, { migrationsFolder: "./drizzle" });
  return wrapSqliteClient(client);
}

describe("HeadplaneDb", () => {
  test("wrapSqliteClient_bundlesSchemaWithConnection", () => {
    const db = createDb();

    expect(db.dialect).toBe("sqlite");
    expect(Object.keys(db.tables).sort()).toEqual(["authSessions", "hostInfo", "users"]);
  });

  test("dispose_onOpenHandle_releasesIt", async () => {
    const db = createDb();
    await db.client.select().from(db.tables.users);

    await db.dispose();

    // A closed node:sqlite handle rejects further statements, which is the
    // observable proof the handle was actually released.
    await expect(db.client.select().from(db.tables.users)).rejects.toThrow();
  });

  test("dispose_calledTwice_doesNotThrow", async () => {
    const db = createDb();

    await db.dispose();
    await expect(db.dispose()).resolves.toBeUndefined();
  });
});
