import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AuthService, Principal } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";
import type { Machine } from "~/types";

import { createTestAuth } from "./create-auth";

vi.mock("~/utils/log", () => ({
  default: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

describe("findOrCreateUser", () => {
  let auth: AuthService;

  beforeEach(() => {
    ({ auth } = createTestAuth());
  });

  test("first created user becomes owner", async () => {
    await auth.findOrCreateUser("sub-owner", { name: "Owner" });
    const role = await auth.roleForSubject("sub-owner");
    expect(role).toBe("owner");
  });

  test("second distinct user stays member", async () => {
    await auth.findOrCreateUser("sub-owner", { name: "Owner" });
    await auth.findOrCreateUser("sub-member", { name: "Member" });
    const role = await auth.roleForSubject("sub-member");
    expect(role).toBe("member");
  });

  test("existing subject returns same id (idempotent)", async () => {
    const id1 = await auth.findOrCreateUser("sub-1", { name: "Alice" });
    const id2 = await auth.findOrCreateUser("sub-1", { name: "Alice" });
    expect(id1).toBe(id2);
  });

  test("updates name and email on re-login", async () => {
    await auth.findOrCreateUser("sub-1", { name: "Old", email: "old@test.com" });
    await auth.findOrCreateUser("sub-1", { name: "New", email: "new@test.com" });

    const users = await auth.listUsers();
    const user = users.find((u) => u.sub === "sub-1");
    expect(user?.name).toBe("New");
    expect(user?.email).toBe("new@test.com");
  });
});

describe("linkHeadscaleUser", () => {
  let auth: AuthService;

  beforeEach(() => {
    ({ auth } = createTestAuth());
  });

  test("links unclaimed Headscale user successfully", async () => {
    const userId = await auth.findOrCreateUser("sub-1");
    const result = await auth.linkHeadscaleUser(userId, "hs-1");
    expect(result).toBe(true);
  });

  test("returns false if another Headplane user already claimed that headscale_user_id", async () => {
    const id1 = await auth.findOrCreateUser("sub-1");
    const id2 = await auth.findOrCreateUser("sub-2");
    await auth.linkHeadscaleUser(id1, "hs-1");

    const result = await auth.linkHeadscaleUser(id2, "hs-1");
    expect(result).toBe(false);
  });

  test("unlinkHeadscaleUser clears the link", async () => {
    const userId = await auth.findOrCreateUser("sub-1");
    await auth.linkHeadscaleUser(userId, "hs-1");
    await auth.unlinkHeadscaleUser(userId);

    const users = await auth.listUsers();
    const user = users.find((u) => u.id === userId);
    expect(user?.headscale_user_id).toBeNull();
  });

  test("linkHeadscaleUserBySubject works through subject lookup", async () => {
    await auth.findOrCreateUser("sub-1");
    const result = await auth.linkHeadscaleUserBySubject("sub-1", "hs-1");
    expect(result).toBe(true);
  });
});

describe("reassignSubject", () => {
  let auth: AuthService;

  beforeEach(() => {
    ({ auth } = createTestAuth());
  });

  test("updates an existing non-owner role", async () => {
    await auth.findOrCreateUser("sub-owner");
    await auth.findOrCreateUser("sub-user");

    const result = await auth.reassignSubject("sub-user", "admin");
    expect(result).toBe(true);

    const role = await auth.roleForSubject("sub-user");
    expect(role).toBe("admin");
  });

  test("returns false for owner demotion attempt", async () => {
    await auth.findOrCreateUser("sub-owner");

    const result = await auth.reassignSubject("sub-owner", "member");
    expect(result).toBe(false);
  });

  test("creates user with role if subject doesn't exist yet (upsert behavior)", async () => {
    const result = await auth.reassignSubject("sub-new", "auditor");
    expect(result).toBe(true);

    const role = await auth.roleForSubject("sub-new");
    expect(role).toBe("auditor");
  });
});

describe("transferOwnership", () => {
  let auth: AuthService;

  beforeEach(() => {
    ({ auth } = createTestAuth());
  });

  test("swaps roles: owner→admin, target→owner", async () => {
    await auth.findOrCreateUser("sub-owner");
    await auth.findOrCreateUser("sub-target");

    const result = await auth.transferOwnership("sub-owner", "sub-target");
    expect(result).toBe(true);

    expect(await auth.roleForSubject("sub-owner")).toBe("admin");
    expect(await auth.roleForSubject("sub-target")).toBe("owner");
  });

  test("returns false if caller is not owner", async () => {
    await auth.findOrCreateUser("sub-owner");
    await auth.findOrCreateUser("sub-other");

    const result = await auth.transferOwnership("sub-other", "sub-owner");
    expect(result).toBe(false);
  });

  test("returns false if target doesn't exist", async () => {
    await auth.findOrCreateUser("sub-owner");

    const result = await auth.transferOwnership("sub-owner", "sub-ghost");
    expect(result).toBe(false);
  });

  test("returns false if target is same user as owner", async () => {
    await auth.findOrCreateUser("sub-owner");

    const result = await auth.transferOwnership("sub-owner", "sub-owner");
    expect(result).toBe(false);
  });
});

describe("session round-trip", () => {
  let auth: AuthService;

  beforeEach(() => {
    ({ auth } = createTestAuth());
  });

  test("createOidcSession + require resolves back to OIDC principal with correct user data", async () => {
    const userId = await auth.findOrCreateUser("sub-1", { name: "Alice", email: "alice@test.com" });

    const cookieHeader = await auth.createOidcSession(userId, {
      name: "Alice",
      email: "alice@test.com",
    });

    const cookieValue = cookieHeader.split(";")[0];
    const request = new Request("http://localhost/test", {
      headers: { cookie: cookieValue },
    });

    const principal = await auth.require(request);
    expect(principal.kind).toBe("oidc");
    if (principal.kind === "oidc") {
      expect(principal.user.id).toBe(userId);
      expect(principal.user.subject).toBe("sub-1");
      expect(principal.profile.name).toBe("Alice");
      expect(principal.profile.email).toBe("alice@test.com");
    }
  });

  test("expired session throws", async () => {
    const userId = await auth.findOrCreateUser("sub-1", { name: "Alice" });

    const cookieHeader = await auth.createOidcSession(userId, { name: "Alice" }, -1);

    const cookieValue = cookieHeader.split(";")[0];
    const request = new Request("http://localhost/test", {
      headers: { cookie: cookieValue },
    });

    await expect(auth.require(request)).rejects.toThrow();
  });
});

describe("authorization", () => {
  let auth: AuthService;

  beforeEach(() => {
    ({ auth } = createTestAuth());
  });

  const apiKeyPrincipal: Principal = {
    kind: "api_key",
    sessionId: "test",
    displayName: "Test Key",
    apiKey: "key",
  };

  const oidcPrincipal: Principal = {
    kind: "oidc",
    sessionId: "test",
    user: { id: "u1", subject: "sub1", role: "viewer", headscaleUserId: "hs-1" },
    profile: { name: "Test" },
  };

  const machine: Machine = {
    id: "m1",
    machineKey: "",
    nodeKey: "",
    discoKey: "",
    ipAddresses: [],
    name: "test",
    lastSeen: "",
    expiry: null,
    createdAt: "",
    registerMethod: "REGISTER_METHOD_OIDC",
    tags: [],
    givenName: "test",
    online: true,
    approvedRoutes: [],
    availableRoutes: [],
    subnetRoutes: [],
    user: { id: "hs-1", name: "test", createdAt: "" },
  };

  test("can() returns true for api_key principal regardless of capability", () => {
    expect(auth.can(apiKeyPrincipal, Capabilities.write_machines)).toBe(true);
    expect(auth.can(apiKeyPrincipal, Capabilities.owner)).toBe(true);
  });

  test("canManageNode() returns true when user owns the node (matching headscaleUserId)", () => {
    expect(auth.canManageNode(oidcPrincipal, machine)).toBe(true);
  });

  test("canManageNode() returns false when user doesn't own the node and lacks write_machines", () => {
    const otherMachine: Machine = {
      ...machine,
      user: { id: "hs-other", name: "other", createdAt: "" },
    };
    expect(auth.canManageNode(oidcPrincipal, otherMachine)).toBe(false);
  });
});
