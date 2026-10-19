import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { action, loader } from "~/routes/auth/link";
import type { User } from "~/types/User";

import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { statusOf, type TestApp } from "../../support/app";

describe("linking an account to a Headscale user", () => {
  let tailnet: Tailnet;
  let app: TestApp;
  const users: Record<string, User> = {};

  beforeAll(async () => {
    tailnet = await createTailnet();
    for (const name of ["carol@", "dave@", "frank@"]) users[name] = await tailnet.user(name);
    users["erin@"] = await tailnet.user("erin@", { email: "erin@corp.test" });
    app = await tailnet.headplane();
    await app.signIn("owner");
  });

  afterAll(async () => {
    await tailnet?.dispose();
  });

  async function linkedTo(userId: string) {
    return (await app.ctx.auth.listUsers()).find((user) => user.id === userId)?.headscale_user_id;
  }

  test("offers only unclaimed users and links the one picked", async () => {
    const other = await app.signIn("member");
    await app.ctx.auth.linkHeadscaleUser(other.userId, users["carol@"].id);
    const admin = await app.signIn("admin");

    const page = (await app.call(loader, "/link", { as: admin.cookie })) as {
      users: Array<{ id: string }>;
    };
    const offered = page.users.map((user) => user.id);
    expect(offered).toContain(users["dave@"].id);
    expect(offered).not.toContain(users["carol@"].id);

    const result = await app.call(action, "/link", {
      as: admin.cookie,
      form: { headscale_user_id: users["dave@"].id },
    });
    expect(statusOf(result)).toBe(302);
    expect(await linkedTo(admin.userId)).toBe(users["dave@"].id);
  });

  test("refuses a user someone else claimed after the page loaded", async () => {
    const admin = await app.signIn("admin");
    const rival = await app.signIn("member");
    await app.ctx.auth.linkHeadscaleUser(rival.userId, users["frank@"].id);

    const result = await app.call(action, "/link", {
      as: admin.cookie,
      form: { headscale_user_id: users["frank@"].id },
    });

    expect(statusOf(result)).toBe(400);
    expect(result).toMatchObject({
      data: { message: "That user can't be linked anymore. Pick another." },
    });
    expect(await linkedTo(admin.userId)).toBeFalsy();
  });

  test("an account with a matching email is linked without asking", async () => {
    const admin = await app.signIn("admin", { email: "erin@corp.test" });

    expect(statusOf(await app.call(loader, "/link", { as: admin.cookie }))).toBe(302);
    expect(await linkedTo(admin.userId)).toBe(users["erin@"].id);
  });

  // Picking would let anyone act as any unclaimed user.
  test("an account that can't manage users can't pick one", async () => {
    const member = await app.signIn("member");

    expect(statusOf(await app.call(loader, "/link", { as: member.cookie }))).toBe(302);
    const result = await app.call(action, "/link", {
      as: member.cookie,
      form: { headscale_user_id: users["dave@"].id },
    });

    expect(statusOf(result)).toBe(302);
    expect(await linkedTo(member.userId)).toBeFalsy();
  });
});
