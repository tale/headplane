import { describe, expect, test } from "vitest";

import { getBootstrapClient, getRuntimeClient, HS_VERSIONS } from "../setup/env";

describe.sequential.for(HS_VERSIONS)("Headscale %s: Pre-auth Keys", (version) => {
  test("pre-auth keys can be created", async () => {
    const client = await getRuntimeClient(version);
    const preAuthKeyUser = await client.users.create({ name: "preauthkeyuser@" });
    expect(preAuthKeyUser).toBeDefined();
    expect(preAuthKeyUser.name).toBe("preauthkeyuser@");

    const expiry = new Date(Date.now() + 3600 * 1000);
    const preAuthKey = await client.preAuthKeys.create({
      user: preAuthKeyUser.id,
      ephemeral: false,
      reusable: false,
      expiration: expiry,
      aclTags: null,
    });

    expect(preAuthKey).toBeDefined();
    expect(preAuthKey.user?.id).toBe(preAuthKeyUser.id);
    expect(preAuthKey.ephemeral).toBe(false);
    expect(preAuthKey.reusable).toBe(false);
    expect(preAuthKey.aclTags).toEqual([]);
    expect(new Date(preAuthKey.expiration).getTime()).toBeCloseTo(expiry.getTime(), -2);
  });

  test("pre-auth keys can be created with ACL tags", async () => {
    const client = await getRuntimeClient(version);
    const [preAuthKeyUser] = await client.users.list({ name: "preauthkeyuser@" });
    expect(preAuthKeyUser).toBeDefined();
    expect(preAuthKeyUser.name).toBe("preauthkeyuser@");

    const aclTags = ["tag:test1", "tag:test2"];
    const preAuthKey = await client.preAuthKeys.create({
      user: preAuthKeyUser.id,
      ephemeral: true,
      reusable: true,
      expiration: null,
      aclTags,
    });

    expect(preAuthKey).toBeDefined();
    expect(preAuthKey.user?.id).toBe(preAuthKeyUser.id);
    expect(preAuthKey.ephemeral).toBe(true);
    expect(preAuthKey.reusable).toBe(true);
    expect(preAuthKey.aclTags.sort()).toEqual(aclTags.sort());
  });

  test("tag-only pre-auth keys (0.28+)", async (context) => {
    const bootstrap = await getBootstrapClient(version);
    if (!bootstrap.capabilities.preAuthKeysHaveStableIds) {
      context.skip();
    }

    const client = await getRuntimeClient(version);
    const aclTags = ["tag:server", "tag:prod"];
    const preAuthKey = await client.preAuthKeys.create({
      user: null,
      ephemeral: false,
      reusable: true,
      expiration: null,
      aclTags,
    });

    expect(preAuthKey).toBeDefined();
    expect(preAuthKey.user).toBeNull();
    expect(preAuthKey.ephemeral).toBe(false);
    expect(preAuthKey.reusable).toBe(true);
    expect(preAuthKey.aclTags.sort()).toEqual(aclTags.sort());
  });

  test("pre-auth keys can be listed", async () => {
    const client = await getRuntimeClient(version);
    const [preAuthKeyUser] = await client.users.list({ name: "preauthkeyuser@" });
    expect(preAuthKeyUser).toBeDefined();
    expect(preAuthKeyUser.name).toBe("preauthkeyuser@");

    const preAuthKeys = await client.preAuthKeys.listForUser(preAuthKeyUser.id);
    expect(Array.isArray(preAuthKeys)).toBe(true);
    expect(preAuthKeys.length).toBeGreaterThanOrEqual(2);
  });

  test("all pre-auth keys can be listed without user filter (0.28+)", async (context) => {
    const bootstrap = await getBootstrapClient(version);
    if (!bootstrap.capabilities.preAuthKeysHaveStableIds) {
      context.skip();
    }

    const client = await getRuntimeClient(version);
    const [preAuthKeyUser] = await client.users.list({ name: "preauthkeyuser@" });
    expect(preAuthKeyUser).toBeDefined();

    const allKeys = await client.preAuthKeys.listAll!();
    expect(Array.isArray(allKeys)).toBe(true);
    expect(allKeys.length).toBeGreaterThanOrEqual(2);

    const userSpecificKeys = await client.preAuthKeys.listForUser(preAuthKeyUser.id);
    for (const userKey of userSpecificKeys) {
      const found = allKeys.find((k) => k.key === userKey.key);
      expect(found).toBeDefined();
    }
  });

  test("listAll returns keys with correct structure (0.28+)", async (context) => {
    const bootstrap = await getBootstrapClient(version);
    if (!bootstrap.capabilities.preAuthKeysHaveStableIds) {
      context.skip();
    }

    const client = await getRuntimeClient(version);
    const allKeys = await client.preAuthKeys.listAll!();

    for (const key of allKeys) {
      expect(key.id).toBeDefined();
      expect(key.key).toBeDefined();
      expect(typeof key.reusable).toBe("boolean");
      expect(typeof key.ephemeral).toBe("boolean");
      expect(typeof key.used).toBe("boolean");
      expect(key.expiration).toBeDefined();
      expect(key.createdAt).toBeDefined();
    }
  });

  test("pre-auth keys can be expired", async () => {
    const client = await getRuntimeClient(version);
    const [preAuthKeyUser] = await client.users.list({ name: "preauthkeyuser@" });
    expect(preAuthKeyUser).toBeDefined();
    expect(preAuthKeyUser.name).toBe("preauthkeyuser@");

    const preAuthKeys = await client.preAuthKeys.listForUser(preAuthKeyUser.id);
    expect(preAuthKeys.length).toBeGreaterThanOrEqual(2);
    const preAuthKeyToExpire = preAuthKeys[0];
    await client.preAuthKeys.expire(preAuthKeyToExpire);

    const preAuthKeysAfterExpire = await client.preAuthKeys.listForUser(preAuthKeyUser.id);
    const expiredKey = preAuthKeysAfterExpire.find((key) => key.key === preAuthKeyToExpire.key);
    expect(expiredKey).toBeDefined();
  });
});
