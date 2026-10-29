import { createHash } from "node:crypto";
import { cp, readdir } from "node:fs/promises";
import { join } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { expect, test } from "vitest";

import { authSessions, hostInfo, users } from "~/server/db/schema";
import { createGuestService } from "~/server/guests";

import { tempDir } from "../../support/temp";

function tableHashes(db: DatabaseSync) {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name != '__drizzle_migrations' ORDER BY name",
    )
    .all();
  return Object.fromEntries(
    tables.map(({ name }) => {
      const rows = db
        .prepare(`SELECT * FROM "${String(name).replaceAll('"', '""')}" ORDER BY rowid`)
        .all();
      return [String(name), createHash("sha256").update(JSON.stringify(rows)).digest("hex")];
    }),
  );
}

test("the additive migration preserves existing users, sessions and host details and guest data survives reopening", async () => {
  const dir = await tempDir();
  const previousMigrations = join(dir, "migrations");
  const folders = (await readdir("drizzle")).sort();
  for (const folder of folders.filter((folder) => !folder.endsWith("_guest_management"))) {
    await cp(join("drizzle", folder), join(previousMigrations, folder), { recursive: true });
  }
  const path = join(dir, "persist.db");
  const db = drizzle(path);
  migrate(db, { migrationsFolder: previousMigrations });
  db.insert(users)
    .values({
      id: "existing-user",
      sub: "existing-subject",
      role: "admin",
      headscale_user_id: "existing-hs-user",
    })
    .run();
  db.insert(authSessions)
    .values({
      id: "existing-session",
      kind: "oidc",
      user_id: "existing-user",
      expires_at: new Date("2030-01-01"),
    })
    .run();
  db.insert(hostInfo).values({ host_id: "existing-machine" }).run();
  const before = tableHashes(db.$client);

  migrate(db, { migrationsFolder: "./drizzle" });
  const after = tableHashes(db.$client);
  for (const [table, hash] of Object.entries(before)) expect(after[table], table).toBe(hash);
  const service = createGuestService(db);
  const created = service.create(
    { email: "persistent@example.com", duration: "172800" },
    "existing-user",
  );
  if (!created.ok) throw new Error(created.error.message);
  db.$client.close();

  const reopened = drizzle(path);
  try {
    migrate(reopened, { migrationsFolder: "./drizzle" });
    expect(createGuestService(reopened).get(created.value.id)).toEqual(created);
    expect(reopened.select().from(users).get()?.headscale_user_id).toBe("existing-hs-user");
    expect(reopened.select().from(authSessions).get()?.id).toBe("existing-session");
  } finally {
    reopened.$client.close();
  }
});

// Explicit opt-in for an operator's development database. SQLite's backup API
// makes a consistent copy, including WAL data; migrations only touch the copy.
test.runIf(process.env.HP_GUEST_MIGRATION_SOURCE)(
  "the migration preserves every existing table on a copy of the development database",
  async () => {
    const dir = await tempDir();
    const path = join(dir, "development-copy.db");
    const source = new DatabaseSync(process.env.HP_GUEST_MIGRATION_SOURCE!, { readOnly: true });
    try {
      await backup(source, path);
    } finally {
      source.close();
    }
    const copy = drizzle(path);
    try {
      const before = tableHashes(copy.$client);
      migrate(copy, { migrationsFolder: "./drizzle" });
      const after = tableHashes(copy.$client);
      for (const [table, hash] of Object.entries(before)) expect(after[table], table).toBe(hash);
      const result = createGuestService(copy).create(
        { email: "migration-check@example.com", duration: "86400" },
        null,
      );
      if (!result.ok) throw new Error(result.error.message);
      expect(createGuestService(copy).get(result.value.id)).toEqual(result);
    } finally {
      copy.$client.close();
    }
  },
);
