import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { loader } from "~/routes/users/overview";
import { userAction } from "~/routes/users/user-actions";
import { parsePolicy } from "~/utils/acl-policy";

import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { waitFor } from "../../harness/wait";
import { createTestApp, statusOf, type TestApp } from "../../support/app";

type LoaderData = Awaited<ReturnType<typeof loader>>;

// One Headscale for the file, so each test gets its own users.
let tailnet: Tailnet;
let app: TestApp;
let owner: { userId: string; cookie: string };
let counter = 0;

beforeAll(async () => {
  tailnet = await createTailnet();
});

afterAll(async () => {
  await tailnet?.dispose();
});

beforeEach(async () => {
  counter += 1;
  app = await tailnet.headplane();
  owner = await app.signIn("owner");
});

function name(base: string) {
  return `${base}${counter}`;
}

function act(form: Record<string, string | string[]>, as = owner.cookie) {
  return app.call(userAction, "/users", { as, form });
}

async function headscaleUser(userName: string) {
  return (await tailnet.api.users.list({ name: userName })).find((u) => u.name === userName);
}

async function headplaneUser(id: string) {
  return (await app.ctx.auth.listUsers()).find((user) => user.id === id);
}

async function groups() {
  const parsed = parsePolicy((await tailnet.api.policy.get()).policy);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.policy.groups;
}

describe("creating users", () => {
  test("stores the display name and email in Headscale", async () => {
    const result = await act({
      intent: "create",
      name: name("erin"),
      display_name: "Erin Example",
      email: "erin@example.com",
    });

    expect(statusOf(result)).toBe(200);
    expect(await headscaleUser(name("erin"))).toMatchObject({
      displayName: "Erin Example",
      email: "erin@example.com",
    });
  });

  test("explains that a name is taken instead of showing Headscale's database error", async () => {
    await tailnet.user(name("frank"));

    expect(await act({ intent: "create", name: name("frank") })).toMatchObject({
      data: { errors: { form: `A user named ${name("frank")} already exists.` } },
    });
  });

  // A trailing @ is accepted by Headscale but can never match an ACL rule.
  test.for(["x", "9lives", "grace@"])("refuses %j as a username", async (userName) => {
    const result = await act({ intent: "create", name: userName });

    expect(statusOf(result)).toBe(400);
    expect(await headscaleUser(userName)).toBeUndefined();
  });
});

describe("renaming users", () => {
  test("renames the user in Headscale", async () => {
    const user = await tailnet.user(name("heidi"));

    const result = await act({ intent: "rename", headscale_user_id: user.id, name: name("hedy") });

    expect(statusOf(result)).toBe(200);
    expect((await tailnet.api.users.list({ id: user.id }))[0].name).toBe(name("hedy"));
  });

  test("explains that the new name is taken", async () => {
    const user = await tailnet.user(name("ivan"));
    await tailnet.user(name("judy"));

    const result = await act({ intent: "rename", headscale_user_id: user.id, name: name("judy") });

    expect(result).toMatchObject({
      data: { errors: { form: `A user named ${name("judy")} already exists.` } },
    });
    expect((await tailnet.api.users.list({ id: user.id }))[0].name).toBe(name("ivan"));
  });

  test("says so when the user is already gone", async () => {
    const result = await act({ intent: "rename", headscale_user_id: "99999", name: name("kim") });

    expect(statusOf(result)).toBe(404);
  });
});

describe("deleting users", () => {
  test("unlinks the Headplane accounts that pointed at the user", async () => {
    const user = await tailnet.user(name("leo"));
    const member = await app.signIn("member");
    await app.ctx.auth.linkHeadscaleUser(member.userId, user.id);

    expect(statusOf(await act({ intent: "delete", headscale_user_id: user.id }))).toBe(200);
    expect(await headscaleUser(name("leo"))).toBeUndefined();
    expect((await headplaneUser(member.userId))?.headscale_user_id).toBeNull();
  });

  test("keeps a user who still has machines, and their link", async () => {
    await tailnet.node({ name: name("mallory-laptop"), user: name("mallory") });
    const user = (await headscaleUser(name("mallory")))!;
    const member = await app.signIn("member");
    await app.ctx.auth.linkHeadscaleUser(member.userId, user.id);

    const result = await act({ intent: "delete", headscale_user_id: user.id });

    expect(statusOf(result)).toBe(400);
    expect(await headscaleUser(name("mallory"))).toBeDefined();
    expect((await headplaneUser(member.userId))?.headscale_user_id).toBe(user.id);
  });
});

describe("roles", () => {
  test("a new role applies to the person's existing session", async () => {
    const viewer = await app.signIn("viewer");
    expect(statusOf(await act({ intent: "create", name: name("nina") }, viewer.cookie))).toBe(403);

    expect(
      statusOf(await act({ intent: "reassign", headplane_user_id: viewer.userId, role: "admin" })),
    ).toBe(200);

    expect(statusOf(await act({ intent: "create", name: name("nina") }, viewer.cookie))).toBe(200);
  });

  test("the owner's role only changes by transferring ownership", async () => {
    const admin = await app.signIn("admin");

    const result = await act(
      { intent: "reassign", headplane_user_id: owner.userId, role: "member" },
      admin.cookie,
    );

    expect(result).toMatchObject({
      data: { errors: { form: "Transfer ownership to change the owner's role." } },
    });
    expect((await headplaneUser(owner.userId))?.role).toBe("owner");
  });

  test("says so when the account is already gone", async () => {
    const result = await act({ intent: "reassign", headplane_user_id: "missing", role: "admin" });

    expect(statusOf(result)).toBe(404);
  });
});

describe("transferring ownership", () => {
  test("hands the instance over and leaves the old owner an admin", async () => {
    const admin = await app.signIn("admin");

    expect(statusOf(await act({ intent: "transfer", headplane_user_id: admin.userId }))).toBe(200);
    expect((await headplaneUser(admin.userId))?.role).toBe("owner");
    expect((await headplaneUser(owner.userId))?.role).toBe("admin");

    // Only the new owner can hand it back.
    expect(await act({ intent: "transfer", headplane_user_id: owner.userId })).toMatchObject({
      data: { errors: { form: "Only the owner can transfer ownership." } },
    });
    expect(
      statusOf(await act({ intent: "transfer", headplane_user_id: owner.userId }, admin.cookie)),
    ).toBe(200);
  });

  test("refuses a transfer to yourself or to an account that's gone", async () => {
    expect(await act({ intent: "transfer", headplane_user_id: owner.userId })).toMatchObject({
      data: { errors: { form: "You already own Headplane." } },
    });
    expect(statusOf(await act({ intent: "transfer", headplane_user_id: "missing" }))).toBe(404);
    expect((await headplaneUser(owner.userId))?.role).toBe("owner");
  });
});

describe("linking accounts to Headscale users", () => {
  test("shows the linked user's machines and groups on the account", async () => {
    await tailnet.node({ name: name("oscar-pc"), user: name("oscar") });
    const oscar = (await headscaleUser(name("oscar")))!;
    const member = await app.signIn("member", { name: "Oscar" });
    await tailnet.setPolicy({ groups: { "group:eng": [`${oscar.name}@`] } });

    const result = await act({
      intent: "link",
      headplane_user_id: member.userId,
      headscale_user_id: oscar.id,
    });
    expect(statusOf(result)).toBe(200);

    const data = (await app.call(loader, "/users", { as: owner.cookie })) as LoaderData;
    const account = data.headplaneUsers.find((user) => user.id === member.userId)!;
    expect(account.linkedHeadscaleUser?.id).toBe(oscar.id);
    expect(account.machines.map((machine) => machine.givenName)).toEqual([name("oscar-pc")]);
    expect(account.groups).toEqual(["group:eng"]);
    expect(data.unlinkedHeadscaleUsers.map((user) => user.id)).not.toContain(oscar.id);
    expect(data.headscaleUsersForLink.find((user) => user.id === oscar.id)?.claimed).toBe(true);
  });

  test("refuses a Headscale user already linked to someone else", async () => {
    const user = await tailnet.user(name("peggy"));
    const first = await app.signIn("member");
    const second = await app.signIn("member");
    await app.ctx.auth.linkHeadscaleUser(first.userId, user.id);

    const result = await act({
      intent: "link",
      headplane_user_id: second.userId,
      headscale_user_id: user.id,
    });

    expect(statusOf(result)).toBe(409);
    expect((await headplaneUser(second.userId))?.headscale_user_id).toBeNull();
  });

  test("refuses a Headscale user that doesn't exist", async () => {
    const member = await app.signIn("member");

    const result = await act({
      intent: "link",
      headplane_user_id: member.userId,
      headscale_user_id: "99999",
    });

    expect(result).toMatchObject({
      data: { errors: { form: "That Headscale user no longer exists." } },
    });
    expect((await headplaneUser(member.userId))?.headscale_user_id).toBeNull();
  });

  test("refuses an account that doesn't exist", async () => {
    const user = await tailnet.user(name("quinn"));

    const result = await act({
      intent: "link",
      headplane_user_id: "missing",
      headscale_user_id: user.id,
    });

    expect(statusOf(result)).toBe(404);
  });
});

describe("groups", () => {
  test("joining a group grants the access the policy gives that group", async () => {
    await tailnet.setPolicy({
      groups: { "group:eng": [] },
      acls: [{ action: "accept", src: ["group:eng"], dst: ["*:*"] }],
    });
    const laptop = await tailnet.node({ name: name("rita-laptop"), user: name("rita") });
    await tailnet.node({ name: name("server"), user: name("sam") });

    const peers = async () => {
      const status = (await laptop.status()) as { Peer?: Record<string, { HostName: string }> };
      return Object.values(status.Peer ?? {}).map((peer) => peer.HostName);
    };
    expect(await peers()).not.toContain(name("server"));

    const result = await act({
      intent: "update_groups",
      user_name: name("rita"),
      groups: ["group:eng"],
    });
    expect(statusOf(result)).toBe(200);

    await waitFor("the server in rita's netmap", async () => {
      expect(await peers()).toContain(name("server"));
    });
  });

  test("leaves the groups not chosen and keeps their other members", async () => {
    const trent = `${name("trent")}@`;
    await tailnet.setPolicy({
      groups: { "group:eng": [trent, "uma@"], "group:ops": [trent] },
    });

    const result = await act({
      intent: "update_groups",
      user_name: name("trent"),
      groups: ["group:ops", "group:sre"],
    });

    expect(statusOf(result)).toBe(200);
    expect(await groups()).toEqual({
      "group:eng": ["uma@"],
      "group:ops": [trent],
      "group:sre": [trent],
    });
  });

  test("an invalid group name leaves the policy alone", async () => {
    await tailnet.setPolicy({ groups: { "group:eng": ["uma@"] } });

    const result = await act({
      intent: "update_groups",
      user_name: name("victor"),
      groups: ["group:eng", "Admins"],
    });

    expect(result).toMatchObject({ data: { errors: { form: "Invalid group name: Admins" } } });
    expect(await groups()).toEqual({ "group:eng": ["uma@"] });
  });
});

describe("with the policy in a file", () => {
  let fileTailnet: Tailnet;

  beforeAll(async () => {
    fileTailnet = await createTailnet({ policyFile: JSON.stringify({ groups: {} }) });
  });

  afterAll(async () => {
    await fileTailnet?.dispose();
  });

  test("groups can't be edited, and the page doesn't offer to", async () => {
    const fileApp = await fileTailnet.headplane();
    const { cookie } = await fileApp.signIn("owner");
    await fileTailnet.user("wendy");

    const result = await fileApp.call(userAction, "/users", {
      as: cookie,
      form: { intent: "update_groups", user_name: "wendy", groups: ["group:eng"] },
    });

    expect(statusOf(result)).toBe(403);
    const data = (await fileApp.call(loader, "/users", { as: cookie })) as LoaderData;
    expect(data.canEditGroups).toBe(false);
  });
});

test("lists Headplane accounts while Headscale is unreachable", async () => {
  await using offline = await createTestApp({
    headscale: { url: "http://127.0.0.1:1", apiKey: "unused" },
  });
  const { cookie, userId } = await offline.signIn("owner");

  const data = (await offline.call(loader, "/users", { as: cookie })) as LoaderData;

  expect(data.apiError).toBeDefined();
  expect(data.headplaneUsers.map((user) => user.id)).toEqual([userId]);
});
