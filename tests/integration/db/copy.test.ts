import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { wrapSqliteClient } from "~/server/db/client.server";
import { createAuthService } from "~/server/web/auth";

import { copyDatabase } from "../../../scripts/db-copy";
import { type PostgresEnv, startPostgres } from "./start-postgres";

vi.mock("~/utils/log", () => ({
  default: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

let postgres: PostgresEnv;
let workDir: string;

beforeAll(async () => {
  postgres = await startPostgres();
  workDir = await mkdtemp(join(tmpdir(), "hp-copy-"));
}, 120_000);

afterAll(async () => {
  await postgres?.stop();
  if (workDir) {
    await rm(workDir, { recursive: true, force: true });
  }
});

let sourceIndex = 0;

/** Builds a populated SQLite database on disk, as an existing install would have. */
async function createSource() {
  const path = join(workDir, `source-${(sourceIndex += 1)}.db`);
  const client = drizzle(path);
  migrate(client, { migrationsFolder: "./drizzle" });
  const db = wrapSqliteClient(client);

  const auth = createAuthService({
    secret: "test-secret-key-for-copy-tests",
    headscaleApiKey: "hs-api-key",
    db,
    cookie: { name: "_hp_test", secure: false, maxAge: 3600 },
  });

  return { path, db, auth };
}

describe("SQLite to PostgreSQL copy", () => {
  beforeEach(async () => {
    await postgres.reset();
  });

  test("copyDatabase_movesUsersRolesAndLinks", async () => {
    const source = await createSource();
    const ownerId = await source.auth.findOrCreateUser("sub-owner", {
      name: "Owner",
      email: "owner@example.com",
    });
    await source.auth.linkHeadscaleUser(ownerId, "hs-1");
    await source.auth.findOrCreateUser("sub-member", { name: "Member" });
    await source.db.dispose();

    const result = await copyDatabase({
      from: source.path,
      to: postgres.url,
      log: () => {},
    });

    expect(result.users).toBe(2);

    const auth = createAuthService({
      secret: "test-secret-key-for-copy-tests",
      headscaleApiKey: "hs-api-key",
      db: postgres.db,
      cookie: { name: "_hp_test", secure: false, maxAge: 3600 },
    });

    // Roles and the Headscale link are the things worth preserving — losing
    // them means every user is recreated as a member on next sign-in.
    expect(await auth.roleForSubject("sub-owner")).toBe("owner");
    expect(await auth.roleForSubject("sub-member")).toBe("member");
    expect(await auth.roleForHeadscaleUser("hs-1")).toBe("owner");
  });

  test("copyDatabase_preservesJsonPayloadsAcrossDialects", async () => {
    const source = await createSource();
    await source.db.client
      .insert(source.db.tables.hostInfo)
      .values({ host_id: "node-1", payload: { os: "linux" } as never });
    await source.db.dispose();

    await copyDatabase({ from: source.path, to: postgres.url, log: () => {} });

    const { hostInfo } = postgres.db.tables;
    const [row] = await postgres.db.client
      .select()
      .from(hostInfo)
      .where(eq(hostInfo.host_id, "node-1"));

    // text-mode JSON on one side, jsonb on the other.
    expect(row.payload).toEqual({ os: "linux" });
  });

  test("copyDatabase_dropsExpiredSessionsAndKeepsLiveOnes", async () => {
    const source = await createSource();
    const userId = await source.auth.findOrCreateUser("sub-owner", { name: "Owner" });
    await source.auth.createOidcSession(userId, { name: "Owner" }, { maxAge: 3600 });
    await source.auth.createOidcSession(userId, { name: "Owner" }, { maxAge: -1 });
    await source.db.dispose();

    const result = await copyDatabase({ from: source.path, to: postgres.url, log: () => {} });

    expect(result.authSessions).toBe(1);
    expect(result.skippedExpiredSessions).toBe(1);
  });

  test("copyDatabase_dryRun_writesNothing", async () => {
    const source = await createSource();
    await source.auth.findOrCreateUser("sub-owner", { name: "Owner" });
    await source.db.dispose();

    const result = await copyDatabase({
      from: source.path,
      to: postgres.url,
      dryRun: true,
      log: () => {},
    });

    expect(result.users).toBe(1);
    expect(await postgres.db.client.select().from(postgres.db.tables.users)).toHaveLength(0);
  });

  test("copyDatabase_intoPopulatedTarget_refusesByDefault", async () => {
    const first = await createSource();
    await first.auth.findOrCreateUser("sub-owner", { name: "Owner" });
    await first.db.dispose();
    await copyDatabase({ from: first.path, to: postgres.url, log: () => {} });

    const second = await createSource();
    await second.auth.findOrCreateUser("sub-other", { name: "Other" });
    await second.db.dispose();

    // Running the copy twice would otherwise fail on a primary key collision
    // partway through, leaving the target half-written.
    await expect(
      copyDatabase({ from: second.path, to: postgres.url, log: () => {} }),
    ).rejects.toThrow(/already contains users/);
  });

  test("copyDatabase_withTwoOwners_failsWithAUsefulMessage", async () => {
    const source = await createSource();
    const first = await source.auth.findOrCreateUser("sub-one", { name: "One" });
    const second = await source.auth.findOrCreateUser("sub-two", { name: "Two" });
    // A hand-repaired database can hold two owners; PostgreSQL's partial
    // unique index will not accept them.
    await source.db.client
      .update(source.db.tables.users)
      .set({ role: "owner" })
      .where(eq(source.db.tables.users.id, second));
    expect(first).not.toBe(second);
    await source.db.dispose();

    await expect(
      copyDatabase({ from: source.path, to: postgres.url, log: () => {} }),
    ).rejects.toThrow(/2 owners/);
  });
});
