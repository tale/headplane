import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { describe, expect, test, vi } from "vitest";

import { closeDbClient } from "~/server/db/client.server";
import { users } from "~/server/db/schema";

vi.mock("~/utils/log", () => ({
  default: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

function createDb() {
  const db = drizzle(":memory:");
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

describe("closeDbClient", () => {
  test("closeDbClient_onOpenHandle_releasesIt", async () => {
    const db = createDb();
    await db.select().from(users);

    closeDbClient(db);

    // A closed node:sqlite handle rejects further statements, which is the
    // observable proof the handle was actually released.
    await expect(db.select().from(users)).rejects.toThrow();
  });

  test("closeDbClient_calledTwice_doesNotThrow", () => {
    const db = createDb();

    closeDbClient(db);
    expect(() => closeDbClient(db)).not.toThrow();
  });
});
