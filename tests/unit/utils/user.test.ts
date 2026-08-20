import { describe, expect, test } from "vitest";

import type { User } from "~/types/User";
import { getUserDisplayName, USERNAME_PATTERN, validateUsername } from "~/utils/user";

const makeUser = (overrides: Partial<User>): User => ({
  id: "default-id",
  name: "",
  createdAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

describe("getUserDisplayName", () => {
  test("uses name when set", () => {
    const user = makeUser({ id: "123", name: "John" });
    expect(getUserDisplayName(user)).toBe("John");
  });

  test("uses displayName when name is empty", () => {
    const user = makeUser({ id: "123", name: "", displayName: "John Doe" });
    expect(getUserDisplayName(user)).toBe("John Doe");
  });

  test("uses email when name and displayName are empty", () => {
    const user = makeUser({ id: "123", name: "", displayName: "", email: "john@example.com" });
    expect(getUserDisplayName(user)).toBe("john@example.com");
  });

  test("uses id when everything else is empty", () => {
    const user = makeUser({ id: "123", name: "", displayName: "", email: "" });
    expect(getUserDisplayName(user)).toBe("123");
  });

  test("uses id when optional fields are undefined", () => {
    const user = makeUser({ id: "123", name: "", displayName: undefined, email: undefined });
    expect(getUserDisplayName(user)).toBe("123");
  });

  test("prefers name over displayName", () => {
    const user = makeUser({
      id: "123",
      name: "John",
      displayName: "John Doe",
      email: "john@example.com",
    });
    expect(getUserDisplayName(user)).toBe("John");
  });

  test("prefers displayName over email", () => {
    const user = makeUser({
      id: "123",
      name: "",
      displayName: "John Doe",
      email: "john@example.com",
    });
    expect(getUserDisplayName(user)).toBe("John Doe");
  });
});

describe("validateUsername", () => {
  test.each(["ab", "john_doe", "user-1.name", "alice@example.com", "josé"])(
    "accepts %s",
    (name) => {
      expect(validateUsername(name)).toBeUndefined();
    },
  );

  // "lm@" is the case from #502: Headscale creates it, but policies strip the
  // trailing "@" so no rule can ever match the user.
  // `ab²`/`abⅫ` are Nl/No, which Go's unicode.IsDigit rejects.
  test.each(["", "a", "1abc", "@abc", "lm@", "a@b@c", "bad name", "bad/name", "ab²", "abⅫ"])(
    "rejects %s",
    (name) => {
      expect(validateUsername(name)).toBeTypeOf("string");
    },
  );
});

describe("USERNAME_PATTERN", () => {
  test("is a valid HTML pattern (unicode sets mode)", () => {
    const regex = new RegExp(`^${USERNAME_PATTERN}$`, "v");
    expect(regex.test("alice@example.com")).toBe(true);
    expect(regex.test("lm@")).toBe(false);
  });
});
