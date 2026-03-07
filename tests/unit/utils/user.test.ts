import { describe, expect, test } from "vitest";

import type { User } from "~/types/User";
import { getUserDisplayName } from "~/utils/user";

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
