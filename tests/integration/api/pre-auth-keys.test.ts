import { describe, expect, test } from "vitest";

import { getBootstrapClient, getIsAtLeast, getRuntimeClient, HS_VERSIONS } from "../setup/env";

describe.sequential.for(HS_VERSIONS)("Headscale %s: Pre-auth Keys", (version) => {
  test("pre-auth keys can be created", async () => {
    const client = await getRuntimeClient(version);
    const preAuthKeyUser = await client.createUser("preauthkeyuser@");
    expect(preAuthKeyUser).toBeDefined();
    expect(preAuthKeyUser.name).toBe("preauthkeyuser@");

    const expiry = new Date(Date.now() + 3600 * 1000);
    const preAuthKey = await client.createPreAuthKey(preAuthKeyUser.id, false, false, expiry, null);

    expect(preAuthKey).toBeDefined();
    expect(preAuthKey.user?.id).toBe(preAuthKeyUser.id);
    expect(preAuthKey.ephemeral).toBe(false);
    expect(preAuthKey.reusable).toBe(false);
    expect(preAuthKey.aclTags).toEqual([]);
    expect(new Date(preAuthKey.expiration).getTime()).toBeCloseTo(expiry.getTime(), -2);
  });

  test("pre-auth keys can be created with ACL tags", async () => {
    const client = await getRuntimeClient(version);
    const [preAuthKeyUser] = await client.getUsers(undefined, "preauthkeyuser@");
    expect(preAuthKeyUser).toBeDefined();
    expect(preAuthKeyUser.name).toBe("preauthkeyuser@");

    const aclTags = ["tag:test1", "tag:test2"];
    const preAuthKey = await client.createPreAuthKey(preAuthKeyUser.id, true, true, null, aclTags);

    expect(preAuthKey).toBeDefined();
    expect(preAuthKey.user?.id).toBe(preAuthKeyUser.id);
    expect(preAuthKey.ephemeral).toBe(true);
    expect(preAuthKey.reusable).toBe(true);
    expect(preAuthKey.aclTags.sort()).toEqual(aclTags.sort());
  });

  test("tag-only pre-auth keys (0.28+)", async (context) => {
    const bootstrap = await getBootstrapClient(version);
    if (!bootstrap.clientHelpers.isAtleast("0.28.0")) {
      context.skip();
    }

    const client = await getRuntimeClient(version);
    const aclTags = ["tag:server", "tag:prod"];
    const preAuthKey = await client.createPreAuthKey(null, false, true, null, aclTags);

    expect(preAuthKey).toBeDefined();
    expect(preAuthKey.user).toBeNull();
    expect(preAuthKey.ephemeral).toBe(false);
    expect(preAuthKey.reusable).toBe(true);
    expect(preAuthKey.aclTags.sort()).toEqual(aclTags.sort());
  });

  test("pre-auth keys can be listed", async () => {
    const client = await getRuntimeClient(version);
    const [preAuthKeyUser] = await client.getUsers(undefined, "preauthkeyuser@");
    expect(preAuthKeyUser).toBeDefined();
    expect(preAuthKeyUser.name).toBe("preauthkeyuser@");

    const preAuthKeys = await client.getPreAuthKeys(preAuthKeyUser.id);
    expect(Array.isArray(preAuthKeys)).toBe(true);
    expect(preAuthKeys.length).toBeGreaterThanOrEqual(2);
  });

  test("all pre-auth keys can be listed without user filter (0.28+)", async (context) => {
    const isAtLeast = await getIsAtLeast(version);
    if (!isAtLeast("0.28.0")) {
      context.skip();
    }

    const client = await getRuntimeClient(version);
    const [preAuthKeyUser] = await client.getUsers(undefined, "preauthkeyuser@");
    expect(preAuthKeyUser).toBeDefined();

    const allKeys = await client.getAllPreAuthKeys();
    expect(Array.isArray(allKeys)).toBe(true);
    expect(allKeys.length).toBeGreaterThanOrEqual(2);

    const userSpecificKeys = await client.getPreAuthKeys(preAuthKeyUser.id);
    for (const userKey of userSpecificKeys) {
      const found = allKeys.find((k) => k.key === userKey.key);
      expect(found).toBeDefined();
    }
  });

  test("getAllPreAuthKeys returns keys with correct structure (0.28+)", async (context) => {
    const isAtLeast = await getIsAtLeast(version);
    if (!isAtLeast("0.28.0")) {
      context.skip();
    }

    const client = await getRuntimeClient(version);
    const allKeys = await client.getAllPreAuthKeys();

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
    const [preAuthKeyUser] = await client.getUsers(undefined, "preauthkeyuser@");
    expect(preAuthKeyUser).toBeDefined();
    expect(preAuthKeyUser.name).toBe("preauthkeyuser@");

    const preAuthKeys = await client.getPreAuthKeys(preAuthKeyUser.id);
    expect(preAuthKeys.length).toBeGreaterThanOrEqual(2);
    const preAuthKeyToExpire = preAuthKeys[0];
    await client.expirePreAuthKey(preAuthKeyUser.id, preAuthKeyToExpire);

    const preAuthKeysAfterExpire = await client.getPreAuthKeys(preAuthKeyUser.id);
    const expiredKey = preAuthKeysAfterExpire.find((key) => key.key === preAuthKeyToExpire.key);
    expect(expiredKey).toBeDefined();
  });
});
