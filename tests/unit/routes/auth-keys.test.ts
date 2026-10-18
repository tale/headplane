import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { action, loader } from "~/routes/settings/auth-keys/overview";
import type { User } from "~/types";

import { createTestApp, statusOf, type TestApp } from "../../support/app";

let app: TestApp;
let alice: User;
let bob: User;

beforeEach(async () => {
  app = await createTestApp();
  alice = await app.api.users.create({ name: "alice@" });
  bob = await app.api.users.create({ name: "bob@" });
});

afterEach(async () => {
  await app.dispose();
});

function create(as: string, form: Record<string, string | string[]>) {
  return app.call(action as never, "/settings/auth-keys", {
    as,
    form: { intent: "create", expiry: "90", ...form },
  });
}

async function keysFor(user: User) {
  return app.api.preAuthKeys.listForUser(user.id);
}

describe("auth key expiry", () => {
  test("accepts a plain integer above the grouping threshold", async () => {
    const { cookie } = await app.signIn("admin");
    const result = await create(cookie, { user_id: alice.id, expiry: "365000" });

    expect(statusOf(result)).toBe(200);
    const [key] = await keysFor(alice);
    const days = Math.round((new Date(key.expiration).getTime() - Date.now()) / 86_400_000);
    expect(days).toBe(365_000);
  });

  // Values >= 1000 used to be submitted through Intl.NumberFormat, which groups
  // digits differently per locale. Leniently parsing those either produced an
  // Invalid Date (500) or, for dot-grouping locales, a silently wrong expiry.
  test.for(["365,000", "365 000", "365 000", "365.000", "0", "-1", "", "90 days", "9999999999999"])(
    "rejects %j",
    async (expiry) => {
      const { cookie } = await app.signIn("admin");
      const result = await create(cookie, { user_id: alice.id, expiry });

      expect(statusOf(result)).toBe(400);
      expect(await keysFor(alice)).toEqual([]);
    },
  );
});

describe("self-service auth keys", () => {
  async function signInAsAlice() {
    const session = await app.signIn("viewer");
    await app.ctx.auth.linkHeadscaleUser(session.userId, alice.id);
    return session.cookie;
  }

  test("a viewer can create a key for their own user", async () => {
    const cookie = await signInAsAlice();

    expect(statusOf(await create(cookie, { user_id: alice.id }))).toBe(200);
    expect(await keysFor(alice)).toHaveLength(1);
  });

  test("a viewer can't create a key for someone else", async () => {
    const cookie = await signInAsAlice();

    expect(statusOf(await create(cookie, { user_id: bob.id }))).toBe(403);
    expect(await keysFor(bob)).toEqual([]);
  });

  test("a viewer can't create a tag-only key", async () => {
    const cookie = await signInAsAlice();

    expect(statusOf(await create(cookie, { tags: "tag:prod" }))).toBe(403);
    expect(await app.api.preAuthKeys.listAll!()).toEqual([]);
  });

  test("a viewer only sees their own user and keys", async () => {
    const { cookie: admin } = await app.signIn("admin");
    await create(admin, { user_id: alice.id });
    await create(admin, { user_id: bob.id });
    await create(admin, { tags: "tag:prod" });

    const data = (await app.call(loader as never, "/settings/auth-keys", {
      as: await signInAsAlice(),
    })) as Awaited<ReturnType<typeof loader>>;

    expect(data.users.map((user) => user.id)).toEqual([alice.id]);
    expect(data.keys.map(({ user }) => user?.id)).toEqual([alice.id]);
  });

  test("an admin sees every user's keys and the tag-only ones", async () => {
    const { cookie } = await app.signIn("admin");
    await create(cookie, { user_id: alice.id });
    await create(cookie, { user_id: bob.id });
    await create(cookie, { tags: "tag:prod" });

    const data = (await app.call(loader as never, "/settings/auth-keys", {
      as: cookie,
    })) as Awaited<ReturnType<typeof loader>>;

    expect(data.keys.map(({ user }) => user?.id ?? null)).toEqual([null, alice.id, bob.id]);
  });
});
