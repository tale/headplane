import { createClient } from "@libsql/client";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { ulid } from "ulidx";
import { beforeEach, describe, expect, test } from "vitest";

import { users } from "~/server/db/schema";
import { Roles } from "~/server/web/roles";

function createTestDb() {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client);
  return { client, db };
}

async function setupSchema(client: ReturnType<typeof createClient>) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      sub TEXT NOT NULL UNIQUE,
      caps INTEGER NOT NULL DEFAULT 0,
      onboarded INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function countOwners(db: ReturnType<typeof drizzle>) {
  const [result] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.caps, Roles.owner));
  return result?.count ?? 0;
}

async function simulateOidcLogin(db: ReturnType<typeof drizzle>, subject: string) {
  const ownerCount = await countOwners(db);
  const needsOwner = ownerCount === 0;

  if (needsOwner) {
    await db
      .insert(users)
      .values({
        id: ulid(),
        sub: subject,
        caps: Roles.owner,
      })
      .onConflictDoUpdate({
        target: users.sub,
        set: { caps: Roles.owner },
      });
  } else {
    await db
      .insert(users)
      .values({
        id: ulid(),
        sub: subject,
        caps: Roles.member,
      })
      .onConflictDoNothing();
  }
}

describe("OIDC owner assignment", () => {
  let db: ReturnType<typeof drizzle>;
  let client: ReturnType<typeof createClient>;

  beforeEach(async () => {
    const testDb = createTestDb();
    db = testDb.db;
    client = testDb.client;
    await setupSchema(client);
  });

  test("first user gets owner role", async () => {
    await simulateOidcLogin(db, "first-user");

    const [user] = await db.select().from(users).where(eq(users.sub, "first-user"));
    expect(user.caps).toBe(Roles.owner);
  });

  test("second user gets member role when owner exists", async () => {
    await simulateOidcLogin(db, "first-user");
    await simulateOidcLogin(db, "second-user");

    const [second] = await db.select().from(users).where(eq(users.sub, "second-user"));
    expect(second.caps).toBe(Roles.member);
  });

  test("existing member becomes owner if no owner exists", async () => {
    await db.insert(users).values({
      id: ulid(),
      sub: "orphaned-user",
      caps: Roles.member,
      onboarded: false,
    });

    await simulateOidcLogin(db, "orphaned-user");

    const [user] = await db.select().from(users).where(eq(users.sub, "orphaned-user"));
    expect(user.caps).toBe(Roles.owner);
  });

  test("existing member stays member when owner exists", async () => {
    await simulateOidcLogin(db, "owner-user");
    await db.insert(users).values({
      id: ulid(),
      sub: "member-user",
      caps: Roles.member,
      onboarded: false,
    });

    await simulateOidcLogin(db, "member-user");

    const [member] = await db.select().from(users).where(eq(users.sub, "member-user"));
    expect(member.caps).toBe(Roles.member);
  });
});
