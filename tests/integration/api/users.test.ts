import { describe, expect, test } from "vitest";

import { getRuntimeClient, HS_VERSIONS } from "../setup/env";

describe.sequential.for(HS_VERSIONS)("Headscale %s: Users", (version) => {
  test("users can be created", async () => {
    const client = await getRuntimeClient(version);
    const user = await client.users.create({ name: "tale@" });
    expect(user).toBeDefined();
    expect(user.name).toBe("tale@");
  });

  test("users can be created with attributes", async () => {
    const client = await getRuntimeClient(version);
    const user = await client.users.create({
      name: "test-user@",
      email: "test-user@example.com",
      displayName: "Test User",
      pictureUrl: "https://github.com/tale.png",
    });

    expect(user).toBeDefined();
    expect(user.name).toBe("test-user@");
    expect(user.email).toBe("test-user@example.com");
    expect(user.displayName).toBe("Test User");
    expect(user.profilePicUrl).toBe("https://github.com/tale.png");
  });

  test("users can be listed", async () => {
    const client = await getRuntimeClient(version);
    const users = await client.users.list();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThanOrEqual(2);
  });

  test("users can be listed by name", async () => {
    const client = await getRuntimeClient(version);
    const users = await client.users.list({ name: "tale@" });
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBe(1);
    expect(users[0].name).toBe("tale@");
  });

  test("users can be listed by email", async () => {
    const client = await getRuntimeClient(version);
    const users = await client.users.list({ email: "test-user@example.com" });
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBe(1);
    expect(users[0].email).toBe("test-user@example.com");
  });

  test("users can be renamed", async () => {
    const client = await getRuntimeClient(version);
    const usersBefore = await client.users.list({ name: "tale@" });
    expect(usersBefore.length).toBe(1);
    const user = usersBefore[0];

    await client.users.rename(user.id, "renamed-user@");
    const usersAfter = await client.users.list({ name: "renamed-user@" });
    expect(usersAfter.length).toBe(1);
    expect(usersAfter[0].id).toBe(user.id);
  });

  test("users can be deleted", async () => {
    const client = await getRuntimeClient(version);
    const usersBefore = await client.users.list({ name: "test-user@" });
    expect(usersBefore.length).toBe(1);
    const user = usersBefore[0];

    await client.users.delete(user.id);
    const usersAfter = await client.users.list({ name: "test-user@" });
    expect(usersAfter.length).toBe(0);
  });
});
