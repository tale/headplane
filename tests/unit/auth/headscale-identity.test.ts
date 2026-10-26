import { describe, expect, test } from "vitest";

import type { Principal } from "~/server/web/auth";
import { findHeadscaleUserBySubject, ownsHeadscaleUser } from "~/server/web/headscale-identity";
import type { User } from "~/types/User";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "1",
    name: "test",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function signedIn(subject: string, headscaleUserId?: string): Principal {
  return {
    kind: "oidc",
    sessionId: "session",
    user: { id: "hp-1", subject, role: "member", headscaleUserId },
    profile: { name: "Alice" },
  };
}

describe("ownsHeadscaleUser", () => {
  test("owns the linked Headscale user", () => {
    expect(ownsHeadscaleUser(signedIn("sub-1", "1"), makeUser({ id: "1" }))).toBe(true);
    expect(ownsHeadscaleUser(signedIn("sub-1", "2"), makeUser({ id: "1" }))).toBe(false);
  });

  test("owns the OIDC user whose providerId ends in their subject", () => {
    const user = makeUser({ provider: "oidc", providerId: "https://idp.example.com/sub-1" });

    expect(ownsHeadscaleUser(signedIn("sub-1"), user)).toBe(true);
    expect(ownsHeadscaleUser(signedIn("sub-2"), user)).toBe(false);
  });

  test("decodes a URL-encoded subject", () => {
    const user = makeUser({ provider: "oidc", providerId: "https://idp.example.com/a%7Cb" });

    expect(ownsHeadscaleUser(signedIn("a|b"), user)).toBe(true);
  });

  test("never matches a subject on non-OIDC users or a missing providerId", () => {
    for (const user of [
      makeUser({ provider: "local", providerId: "https://idp.example.com/sub-1" }),
      makeUser({ provider: "oidc" }),
      makeUser({ provider: "oidc", providerId: "" }),
    ]) {
      expect(ownsHeadscaleUser(signedIn("sub-1"), user)).toBe(false);
    }
  });

  test("API key sessions own no Headscale user", () => {
    const principal: Principal = {
      kind: "api_key",
      sessionId: "session",
      displayName: "API key",
      apiKey: "hskey-api-x",
    };

    expect(ownsHeadscaleUser(principal, makeUser())).toBe(false);
  });
});

describe("findHeadscaleUserBySubject", () => {
  const oidcUser = makeUser({
    id: "1",
    provider: "oidc",
    providerId: "https://idp.example.com/sub-1",
    email: "alice@example.com",
  });

  const localUser = makeUser({
    id: "2",
    provider: "local",
    email: "bob@example.com",
  });

  const users = [oidcUser, localUser];

  test("matches by subject first", () => {
    expect(findHeadscaleUserBySubject(users, "sub-1")).toBe(oidcUser);
  });

  test("falls back to email if no subject match", () => {
    expect(findHeadscaleUserBySubject(users, "no-match", "bob@example.com")).toBe(localUser);
  });

  test("returns undefined if no email and no subject match", () => {
    expect(findHeadscaleUserBySubject(users, "no-match")).toBeUndefined();
  });

  test("prefers subject match over email match", () => {
    const otherOidc = makeUser({
      id: "3",
      provider: "oidc",
      providerId: "https://idp.example.com/sub-2",
      email: "alice@example.com",
    });

    expect(findHeadscaleUserBySubject([oidcUser, otherOidc], "sub-2", "alice@example.com")).toBe(
      otherOidc,
    );
  });
});
