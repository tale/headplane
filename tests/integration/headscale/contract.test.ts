import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { HeadscaleClient } from "~/server/headscale/api";
import { headscaleErrorMessage } from "~/server/headscale/api/error-client";
import type { Machine, User } from "~/types";

import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { type HeadscaleVersion, testedVersions } from "../../harness/versions";

// What Headplane relies on from Headscale's API, asserted through Headplane's
// client against each version we support.

// 0.28+ lists show "tagged-devices"; a single read shows the old user or none.
function expectTaggedOwner(version: HeadscaleVersion, listed: Machine, read: Machine, user: User) {
  if (!gte(version, "0.28.0")) {
    expect(listed.user?.id).toBe(user.id);
    expect(read.user?.id).toBe(user.id);
    return;
  }

  expect(listed.user?.name).toBe("tagged-devices");
  expect(read.user?.id).toBe(gte(version, "0.29.0") ? undefined : user.id);
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );

  expect(error, "expected the call to fail").toBeDefined();
  return headscaleErrorMessage(error) ?? String(error);
}

function gte(version: HeadscaleVersion, target: string) {
  const [a, b] = version.split(".").map(Number);
  const [x, y] = target.split(".").map(Number);
  return a !== x ? a > x : b >= y;
}

for (const version of testedVersions()) {
  const hasStableKeyIds = gte(version, "0.28.0");
  const canDisableExpiry = gte(version, "0.29.0");
  const acceptsGrants = gte(version, "0.29.0");

  // Tests use unique names so they can share one tailnet and run at once.
  describe.concurrent(`Headscale ${version} contract`, () => {
    let tailnet: Tailnet;
    let api: HeadscaleClient;
    let counter = 0;
    const unique = (name: string) => `${name}${++counter}`;

    beforeAll(async () => {
      tailnet = await createTailnet({ version });
      api = tailnet.api;
    });

    afterAll(async () => {
      await tailnet?.dispose();
    });

    test("capabilities follow the version", () => {
      expect(tailnet.headscale.version.unknown).toBe(false);
      expect(tailnet.headscale.capabilities).toEqual({
        preAuthKeysHaveStableIds: hasStableKeyIds,
        nodeTagsAreFlat: hasStableKeyIds,
        nodeOwnerIsImmutable: hasStableKeyIds,
        registerKeyIncludesAuthReqPrefix: canDisableExpiry,
        keyExpiryCanBeDisabled: canDisableExpiry,
        policySupportsGrants: acceptsGrants,
      });
    });

    test("a wrong API key is unauthorized", async () => {
      const message = await rejection(tailnet.headscale.client("not-a-key").users.list());
      expect(message).toBe("Unauthorized");
    });

    test("an API key that can't be a header never reaches Headscale", async () => {
      const message = await rejection(tailnet.headscale.client("not\na-key").users.list());
      expect(message).toBe("Couldn't reach Headscale. Check that it's running and try again.");
    });

    describe("users", () => {
      test("created users keep their profile and can be filtered", async () => {
        const name = `${unique("bob")}@`;
        const email = `${name}example.com`;
        const user = await api.users.create({
          name,
          email,
          displayName: "Bob B",
          pictureUrl: "https://example.com/b.png",
        });

        expect(user).toMatchObject({
          name,
          email,
          displayName: "Bob B",
          profilePicUrl: "https://example.com/b.png",
        });

        expect(await api.users.list({ name })).toEqual([user]);
        expect(await api.users.list({ email })).toEqual([user]);
        expect(await api.users.list({ id: user.id })).toEqual([user]);
        expect(await api.users.list({ name: "nobody-by-this-name" })).toEqual([]);
      });

      test("names are unique on create and rename", async () => {
        const first = await api.users.create({ name: unique("taken") });
        const second = await api.users.create({ name: unique("free") });

        expect(await rejection(api.users.create({ name: first.name }))).toContain("UNIQUE");
        expect(await rejection(api.users.rename(second.id, first.name))).toContain("UNIQUE");
      });

      test("rename changes the name", async () => {
        const user = await api.users.create({ name: unique("before") });
        const name = unique("after");
        await api.users.rename(user.id, name);

        expect((await api.users.list({ id: user.id }))[0].name).toBe(name);
      });

      test("missing users are reported", async () => {
        expect(await rejection(api.users.rename("999999", "x"))).toBe("User not found");
        expect(await rejection(api.users.delete("999999"))).toBe("User not found");
      });
    });

    describe("pre-auth keys", () => {
      test("a created key has the options it was created with", async () => {
        const user = await api.users.create({ name: unique("keys") });
        const expiration = new Date(Date.now() + 3_600_000);
        const key = await api.preAuthKeys.create({
          user: user.id,
          reusable: true,
          ephemeral: true,
          expiration,
          aclTags: ["tag:ci"],
        });

        expect(key).toMatchObject({
          user: { id: user.id, name: user.name },
          reusable: true,
          ephemeral: true,
          used: false,
          aclTags: ["tag:ci"],
        });
        expect(new Date(key.expiration).getTime()).toBeCloseTo(expiration.getTime(), -3);

        await api.preAuthKeys.create({
          user: (await api.users.create({ name: unique("otherkeys") })).id,
          reusable: false,
          ephemeral: false,
          expiration: null,
          aclTags: null,
        });

        const listed = await api.preAuthKeys.listForUser(user.id);
        expect(listed.map((k) => k.id)).toEqual([key.id]);
      });

      test("only the create response has the full secret", async () => {
        const user = await api.users.create({ name: unique("secret") });
        const key = await api.preAuthKeys.create({
          user: user.id,
          reusable: false,
          ephemeral: false,
          expiration: new Date(Date.now() + 3_600_000),
          aclTags: null,
        });

        const listed = (await api.preAuthKeys.listForUser(user.id)).find((k) => k.id === key.id)!;
        if (hasStableKeyIds) {
          expect(key.key).toMatch(/^hskey-auth-/);
          expect(listed.key).toBe(`${key.key.slice(0, 23)}-***`);
        } else {
          expect(listed.key).toBe(key.key);
        }
      });

      test("a key without an expiration gets the zero time", async () => {
        const user = await api.users.create({ name: unique("forever") });
        const key = await api.preAuthKeys.create({
          user: user.id,
          reusable: false,
          ephemeral: false,
          expiration: null,
          aclTags: null,
        });

        expect(key.expiration).toBe("0001-01-01T00:00:00Z");
      });

      test("tags must start with tag:", async () => {
        const user = await api.users.create({ name: unique("badtag") });
        const message = await rejection(
          api.preAuthKeys.create({
            user: user.id,
            reusable: false,
            ephemeral: false,
            expiration: null,
            aclTags: ["server"],
          }),
        );

        expect(message).toBe("Tag must start with the string 'tag:'");
      });

      test("an expired key reports an expiration in the past", async () => {
        const user = await api.users.create({ name: unique("expire") });
        const key = await api.preAuthKeys.create({
          user: user.id,
          reusable: false,
          ephemeral: false,
          expiration: new Date(Date.now() + 3_600_000),
          aclTags: null,
        });

        await api.preAuthKeys.expire(key);
        const listed = (await api.preAuthKeys.listForUser(user.id)).find((k) => k.id === key.id)!;
        expect(new Date(listed.expiration).getTime()).toBeLessThanOrEqual(Date.now());
      });

      test.runIf(hasStableKeyIds)("tag-only keys have no user and show up in listAll", async () => {
        const key = await api.preAuthKeys.create({
          user: null,
          reusable: false,
          ephemeral: false,
          expiration: null,
          aclTags: ["tag:server"],
        });

        expect(key.user).toBeNull();
        const all = await api.preAuthKeys.listAll!();
        expect(all.find((k) => k.id === key.id)).toMatchObject({
          user: null,
          aclTags: ["tag:server"],
        });
      });

      test.runIf(!hasStableKeyIds)("tag-only keys and listAll aren't available", async () => {
        expect(api.preAuthKeys.listAll).toBeUndefined();
        const message = await rejection(
          api.preAuthKeys.create({
            user: null,
            reusable: false,
            ephemeral: false,
            expiration: null,
            aclTags: ["tag:server"],
          }),
        );

        expect(message).toBe("User not found");
      });
    });

    test("API keys are listed by prefix", async () => {
      const keys = await api.apiKeys.list();
      const prefix = hasStableKeyIds
        ? `${tailnet.server.apiKey.slice(0, 22)}-***`
        : tailnet.server.apiKey.slice(0, 7);

      expect(keys.map((k) => k.prefix)).toContain(prefix);
    });

    describe("nodes", () => {
      test("a joined node reports its owner, addresses, and advertised routes", async () => {
        const user = await api.users.create({ name: unique("nodeowner") });
        const name = unique("web");
        const { id } = await tailnet.node({
          name,
          user: user.name,
          routes: ["10.0.0.0/24"],
          exitNode: true,
        });

        const node = await api.nodes.get(id);
        expect(node).toMatchObject({
          id,
          name,
          givenName: name,
          user: { id: user.id, name: user.name },
          online: true,
          registerMethod: "REGISTER_METHOD_AUTH_KEY",
          tags: [],
          approvedRoutes: [],
          availableRoutes: ["0.0.0.0/0", "10.0.0.0/24", "::/0"],
        });
        expect(node.ipAddresses).toEqual([
          expect.stringMatching(/^100\.64\./),
          expect.stringMatching(/^fd7a:115c:a1e0::/),
        ]);
        expect(node.expiry).toBe(canDisableExpiry ? null : "0001-01-01T00:00:00Z");
        expect((await api.nodes.list()).map((n) => n.id)).toContain(id);

        await api.nodes.approveRoutes(id, ["10.0.0.0/24", "0.0.0.0/0", "::/0"]);
        expect((await api.nodes.get(id)).approvedRoutes).toEqual([
          "0.0.0.0/0",
          "10.0.0.0/24",
          "::/0",
        ]);
      });

      test("a node joined with a tagged key is owned by its tags", async () => {
        const user = await api.users.create({ name: unique("tagger") });
        const { id } = await tailnet.node({
          name: unique("db"),
          user: user.name,
          tags: ["tag:db"],
        });

        const node = await api.nodes.get(id);
        const listed = (await api.nodes.list()).find((n) => n.id === id)!;
        expect(node.tags).toEqual(["tag:db"]);
        expect(listed.tags).toEqual(["tag:db"]);
        expectTaggedOwner(version, listed, node, user);
      });

      test("rename sets the given name and keeps the hostname", async () => {
        const user = await api.users.create({ name: unique("renamer") });
        const name = unique("host");
        const { id } = await tailnet.node({ name, user: user.name });
        const other = await tailnet.node({ name: unique("other"), user: user.name });
        const givenName = unique("renamed");

        await api.nodes.rename(id, givenName);
        expect(await api.nodes.get(id)).toMatchObject({ name, givenName });

        expect(await rejection(api.nodes.rename(other.id, givenName))).toMatch(/is not unique/);
        expect(await rejection(api.nodes.rename(other.id, "Bad_Name!"))).toContain("Bad_Name!");
      });

      test("tags are validated and replace the node's tags", async () => {
        await api.policy.set(JSON.stringify({ tagOwners: { "tag:web": [] }, acls: [] }));
        const user = await api.users.create({ name: unique("tags") });
        const { id } = await tailnet.node({ name: unique("tagme"), user: user.name });

        expect(await rejection(api.nodes.setTags(id, ["web"]))).toBe(
          "Tag must start with the string 'tag:'",
        );

        await api.nodes.setTags(id, ["tag:web"]);
        const node = await api.nodes.get(id);
        const listed = (await api.nodes.list()).find((n) => n.id === id)!;
        expect(node.tags).toEqual(["tag:web"]);
        expectTaggedOwner(version, listed, node, user);

        if (hasStableKeyIds) {
          expect(await rejection(api.nodes.setTags(id, ["tag:undeclared"]))).toBe(
            "Requested tags [tag:undeclared] are invalid or not permitted",
          );
        } else {
          await api.nodes.setTags(id, ["tag:undeclared"]);
          expect((await api.nodes.get(id)).tags).toEqual(["tag:undeclared"]);
        }
      });

      test("expiring a node sets its expiry to now", async () => {
        const user = await api.users.create({ name: unique("expirer") });
        const { id } = await tailnet.node({ name: unique("expiring"), user: user.name });

        await api.nodes.expire(id);
        const node = await api.nodes.get(id);
        expect(new Date(node.expiry!).getTime()).toBeLessThanOrEqual(Date.now());
      });

      test.runIf(canDisableExpiry)("key expiry can be disabled and enabled again", async () => {
        const user = await api.users.create({ name: unique("noexpiry") });
        const { id } = await tailnet.node({ name: unique("forever"), user: user.name });

        await api.nodes.toggleExpiry(id, true);
        expect((await api.nodes.get(id)).expiry).toBeNull();

        // Turning it back on must not sign the machine out.
        await api.nodes.toggleExpiry(id, false);
        const node = await api.nodes.get(id);
        expect(new Date(node.expiry!).getTime()).toBeGreaterThan(Date.now() + 170 * 86_400_000);
        expect(node.online).toBe(true);
      });

      test.runIf(!canDisableExpiry)("disabling expiry expires the node instead", async () => {
        const user = await api.users.create({ name: unique("noexpiry") });
        const { id } = await tailnet.node({ name: unique("forever"), user: user.name });

        await api.nodes.toggleExpiry(id, true);
        const node = await api.nodes.get(id);
        expect(new Date(node.expiry!).getTime()).toBeLessThanOrEqual(Date.now());
      });

      test.runIf(!hasStableKeyIds)("nodes can move to another user", async () => {
        const from = await api.users.create({ name: unique("from") });
        const to = await api.users.create({ name: unique("to") });
        const { id } = await tailnet.node({ name: unique("mover"), user: from.name });

        await api.nodes.reassignUser!(id, to.id);
        expect((await api.nodes.get(id)).user?.id).toBe(to.id);
      });

      test.runIf(hasStableKeyIds)("nodes can't move to another user", () => {
        expect(api.nodes.reassignUser).toBeUndefined();
      });

      test("deleted nodes are gone", async () => {
        const user = await api.users.create({ name: unique("deleter") });
        const { id } = await tailnet.node({ name: unique("doomed"), user: user.name });

        await api.nodes.delete(id);
        expect(await rejection(api.nodes.get(id))).toBe("Node not found");
        expect(await rejection(api.nodes.delete(id))).toBe("Node not found");
      });

      test("a waiting node registers to a user with the key from its URL", async () => {
        const user = await api.users.create({ name: unique("registrar") });
        const name = unique("pending");
        const pending = await tailnet.pendingNode({ name });
        const key = pending.registerUrl.split("/register/")[1];
        expect(key.startsWith("hskey-authreq-")).toBe(canDisableExpiry);

        const node = await api.nodes.register(user.name, key);
        expect(node).toMatchObject({
          name,
          user: { id: user.id },
          registerMethod: "REGISTER_METHOD_CLI",
        });
      });

      test("a malformed registration key is rejected", async () => {
        const user = await api.users.create({ name: unique("badreg") });
        const message = await rejection(api.nodes.register(user.name, "nope"));

        expect(message).toBe(
          canDisableExpiry
            ? 'Auth ID has invalid prefix: expected prefix "hskey-authreq-"'
            : "Registration ID must be 24 characters long",
        );
      });
    });
  });

  // Deleting a user on 0.28.0 deletes every user's auth keys, which would
  // break the tests running alongside, so these get a tailnet of their own.
  describe(`Headscale ${version} user deletion contract`, () => {
    let tailnet: Tailnet;

    beforeAll(async () => {
      tailnet = await createTailnet({ version });
    });

    afterAll(async () => {
      await tailnet?.dispose();
    });

    test("a user who owns a node can't be deleted", async () => {
      const user = await tailnet.api.users.create({ name: "owner" });
      await tailnet.node({ name: "owned", user: user.name });

      expect(await rejection(tailnet.api.users.delete(user.id))).toBe(
        "User not empty: node(s) found",
      );
    });

    test("deleted users are gone", async () => {
      const user = await tailnet.api.users.create({ name: "gone" });
      await tailnet.api.users.delete(user.id);

      expect(await tailnet.api.users.list({ id: user.id })).toEqual([]);
    });

    test(`deleting a user ${version === "0.28.0" ? "deletes" : "keeps"} everyone else's auth keys`, async () => {
      const kept = await tailnet.api.users.create({ name: "kept" });
      await tailnet.api.preAuthKeys.create({
        user: kept.id,
        reusable: false,
        ephemeral: false,
        expiration: null,
        aclTags: null,
      });

      const deleted = await tailnet.api.users.create({ name: "deleted" });
      await tailnet.api.users.delete(deleted.id);

      const keys = await tailnet.api.preAuthKeys.listForUser(kept.id);
      expect(keys).toHaveLength(version === "0.28.0" ? 0 : 1);
    });
  });

  describe(`Headscale ${version} policy contract`, () => {
    let tailnet: Tailnet;

    beforeAll(async () => {
      tailnet = await createTailnet({ version });
    });

    afterAll(async () => {
      await tailnet?.dispose();
    });

    test("a new tailnet has no policy", async () => {
      expect(await rejection(tailnet.api.policy.get())).toBe(
        "Loading ACL from database: acl policy not found",
      );
    });

    test("a policy round-trips with its comments and trailing commas", async () => {
      const policy = '// keep me\n{"acls":[{"action":"accept","src":["*"],"dst":["*:*"]}],}';
      const saved = await tailnet.api.policy.set(policy);
      const read = await tailnet.api.policy.get();

      expect(saved.policy).toBe(policy);
      expect(read).toEqual({ policy, updatedAt: saved.updatedAt });
    });

    test("invalid HuJSON is rejected", async () => {
      expect(await rejection(tailnet.api.policy.set("{"))).toMatch(
        /^Setting policy: parsing policy: parsing HuJSON: /,
      );
    });

    test(`a policy with grants is ${acceptsGrants ? "accepted" : "rejected"}`, async () => {
      const policy = '{"grants":[{"src":["*"],"dst":["*"],"ip":["*"]}]}';
      const result = await tailnet.api.policy.set(policy).then(
        () => "accepted",
        (error: unknown) => headscaleErrorMessage(error),
      );

      expect(result).toMatch(acceptsGrants ? /^accepted$/ : /unknown field "grants"/);
    });
  });
}
