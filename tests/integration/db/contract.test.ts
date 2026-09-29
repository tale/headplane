import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { type HeadplaneDb, wrapSqliteClient } from "~/server/db/client.server";
import { createAuthService } from "~/server/web/auth";

import { type PostgresEnv, startPostgres } from "./start-postgres";

vi.mock("~/utils/log", () => ({
  default: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

// The same query code runs against both engines. This suite is what makes the
// single client cast in `client.server.ts` safe: the compiler cannot prove the
// dialects behave alike, so these tests do it instead.

let postgres: PostgresEnv;

beforeAll(async () => {
  postgres = await startPostgres();
}, 120_000);

afterAll(async () => {
  await postgres?.stop();
});

function createSqliteDb(): HeadplaneDb {
  const client = drizzle(":memory:");
  migrate(client, { migrationsFolder: "./drizzle" });
  return wrapSqliteClient(client);
}

function authFor(db: HeadplaneDb) {
  return createAuthService({
    secret: "test-secret-key-for-contract-tests",
    headscaleApiKey: "hs-api-key",
    db,
    cookie: { name: "_hp_test", secure: false, maxAge: 3600 },
  });
}

const dialects = [
  { name: "sqlite", create: async () => createSqliteDb() },
  {
    name: "postgres",
    create: async () => {
      await postgres.reset();
      return postgres.db;
    },
  },
] as const;

describe.each(dialects)("$name", ({ create }) => {
  let db: HeadplaneDb;
  let auth: ReturnType<typeof authFor>;

  beforeEach(async () => {
    db = await create();
    auth = authFor(db);
  });

  test("findOrCreateUser_firstUser_becomesOwner", async () => {
    await auth.findOrCreateUser("sub-one", { name: "One" });
    expect(await auth.roleForSubject("sub-one")).toBe("owner");
  });

  test("findOrCreateUser_secondUser_staysMember", async () => {
    await auth.findOrCreateUser("sub-one", { name: "One" });
    await auth.findOrCreateUser("sub-two", { name: "Two" });
    expect(await auth.roleForSubject("sub-two")).toBe("member");
  });

  test("findOrCreateUser_existingSubject_updatesInsteadOfInserting", async () => {
    const first = await auth.findOrCreateUser("sub-one", { name: "One" });
    const again = await auth.findOrCreateUser("sub-one", { name: "One Renamed" });

    expect(again).toBe(first);
    const users = await auth.listUsers();
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("One Renamed");
  });

  test("timestamps_roundTripAsDates", async () => {
    await auth.findOrCreateUser("sub-one", { name: "One" });
    const [user] = await auth.listUsers();

    // SQLite stores an integer epoch, PostgreSQL a timestamptz. Both must
    // surface as a Date or every comparison downstream is wrong.
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.created_at!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  test("nullableColumns_roundTripAsNull", async () => {
    await auth.findOrCreateUser("sub-one");
    const [user] = await auth.listUsers();

    expect(user.email ?? null).toBeNull();
    expect(user.headscale_user_id ?? null).toBeNull();
  });

  test("linkHeadscaleUser_thenUnlink_clearsTheColumn", async () => {
    const id = await auth.findOrCreateUser("sub-one");

    expect(await auth.linkHeadscaleUser(id, "hs-1")).toBe(true);
    expect(await auth.roleForHeadscaleUser("hs-1")).toBe("owner");
    expect([...(await auth.claimedHeadscaleUserIds())]).toEqual(["hs-1"]);

    await auth.unlinkHeadscaleUser(id);
    expect(await auth.roleForHeadscaleUser("hs-1")).toBeUndefined();
  });

  test("linkHeadscaleUser_alreadyClaimed_isRejected", async () => {
    const first = await auth.findOrCreateUser("sub-one");
    const second = await auth.findOrCreateUser("sub-two");

    expect(await auth.linkHeadscaleUser(first, "hs-1")).toBe(true);
    expect(await auth.linkHeadscaleUser(second, "hs-1")).toBe(false);
  });

  test("transferOwnership_movesTheOwnerRole", async () => {
    const owner = await auth.findOrCreateUser("sub-one");
    const target = await auth.findOrCreateUser("sub-two");

    expect(await auth.transferOwnership(owner, target)).toBe(true);
    expect(await auth.roleForSubject("sub-two")).toBe("owner");
    expect(await auth.roleForSubject("sub-one")).toBe("admin");
  });

  test("sessions_expireAndPrune", async () => {
    const id = await auth.findOrCreateUser("sub-one");
    await auth.createOidcSession(id, { name: "One" }, { maxAge: -1 });

    const { authSessions } = db.tables;
    expect(await db.client.select().from(authSessions)).toHaveLength(1);

    await auth.pruneExpiredSessions();
    expect(await db.client.select().from(authSessions)).toHaveLength(0);
  });

  test("hostInfoPayload_roundTripsAsAnObject", async () => {
    const { hostInfo } = db.tables;
    const payload = { os: "linux", hostname: "node-1" } as never;

    await db.client.insert(hostInfo).values({ host_id: "node-1", payload });

    const [row] = await db.client.select().from(hostInfo).where(eq(hostInfo.host_id, "node-1"));

    // SQLite round-trips JSON as text, PostgreSQL parses jsonb server-side.
    // Both must hand back an object, not a string.
    expect(row.payload).toEqual({ os: "linux", hostname: "node-1" });
  });

  test("hostInfoPayload_upsertReplacesTheRow", async () => {
    const { hostInfo } = db.tables;

    for (const os of ["linux", "darwin"]) {
      await db.client
        .insert(hostInfo)
        .values({ host_id: "node-1", payload: { os } as never })
        .onConflictDoUpdate({
          target: hostInfo.host_id,
          set: { payload: { os } as never },
        });
    }

    const rows = await db.client.select().from(hostInfo);
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toEqual({ os: "darwin" });
  });

  test("concurrentFirstLogins_produceExactlyOneOwner", async () => {
    await Promise.all([
      auth.findOrCreateUser("sub-race-a", { name: "A" }),
      auth.findOrCreateUser("sub-race-b", { name: "B" }),
    ]);

    const owners = (await auth.listUsers()).filter((user) => user.role === "owner");
    expect(owners).toHaveLength(1);
  });
});

describe("postgres-specific guarantees", () => {
  beforeEach(async () => {
    await postgres.reset();
  });

  test("usersSingleOwnerIndex_rejectsASecondOwner", async () => {
    // The conditional UPDATE in findOrCreateUser is atomic under SQLite's
    // serialized writes but not under PostgreSQL READ COMMITTED, where two
    // concurrent first logins can both promote themselves. This partial unique
    // index is the actual guarantee, so assert it exists and bites.
    const { users } = postgres.db.tables;
    const auth = authFor(postgres.db);

    await auth.findOrCreateUser("sub-owner", { name: "Owner" });
    const second = await auth.findOrCreateUser("sub-other", { name: "Other" });

    await expect(
      postgres.db.client.update(users).set({ role: "owner" }).where(eq(users.id, second)),
    ).rejects.toThrow();
  });
});
