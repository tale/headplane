import { describe, expect, test } from "vitest";

import { findHeadscaleUserBySubject, getOidcSubject } from "~/server/web/headscale-identity";
import type { User } from "~/types/User";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "1",
    name: "test",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getOidcSubject", () => {
  test("returns undefined for non-OIDC users", () => {
    expect(getOidcSubject(makeUser({ provider: "local" }))).toBeUndefined();
    expect(getOidcSubject(makeUser())).toBeUndefined();
  });

  test("returns undefined when providerId is missing", () => {
    expect(getOidcSubject(makeUser({ provider: "oidc" }))).toBeUndefined();
    expect(getOidcSubject(makeUser({ provider: "oidc", providerId: "" }))).toBeUndefined();
  });

  test("returns last path segment from providerId URL", () => {
    const user = makeUser({
      provider: "oidc",
      providerId: "https://idp.example.com/abc-123",
    });
    expect(getOidcSubject(user)).toBe("abc-123");
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
