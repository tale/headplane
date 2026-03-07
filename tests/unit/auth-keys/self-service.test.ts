import { describe, expect, test } from "vitest";

import { Capabilities, hasCapability, Roles } from "~/server/web/roles";

describe("Self-service pre-auth keys", () => {
  describe("Capabilities", () => {
    test("generate_own_authkeys capability exists", () => {
      expect(Capabilities.generate_own_authkeys).toBeDefined();
      expect(typeof Capabilities.generate_own_authkeys).toBe("number");
    });

    test("generate_own_authkeys is distinct from generate_authkeys", () => {
      expect(Capabilities.generate_own_authkeys).not.toBe(Capabilities.generate_authkeys);
    });
  });

  describe("Auditor role", () => {
    test("auditor has generate_own_authkeys", () => {
      expect(hasCapability("auditor", "generate_own_authkeys")).toBe(true);
    });

    test("auditor does not have generate_authkeys", () => {
      expect(hasCapability("auditor", "generate_authkeys")).toBe(false);
    });

    test("auditor has read permissions", () => {
      expect(hasCapability("auditor", "read_machines")).toBe(true);
      expect(hasCapability("auditor", "read_users")).toBe(true);
      expect(hasCapability("auditor", "read_policy")).toBe(true);
    });
  });

  describe("Admin roles retain full access", () => {
    test("owner has generate_authkeys", () => {
      expect(hasCapability("owner", "generate_authkeys")).toBe(true);
    });

    test("admin has generate_authkeys", () => {
      expect(hasCapability("admin", "generate_authkeys")).toBe(true);
    });

    test("it_admin has generate_authkeys", () => {
      expect(hasCapability("it_admin", "generate_authkeys")).toBe(true);
    });

    test("network_admin has generate_authkeys", () => {
      expect(hasCapability("network_admin", "generate_authkeys")).toBe(true);
    });
  });

  describe("Member role", () => {
    test("member has no capabilities", () => {
      expect(Roles.member).toBe(0);
    });

    test("member does not have generate_own_authkeys", () => {
      expect(hasCapability("member", "generate_own_authkeys")).toBe(false);
    });
  });
});

describe("providerId subject extraction", () => {
  function extractSubject(providerId: string | undefined): string | undefined {
    return providerId?.split("/").pop();
  }

  test("extracts subject from oidc providerId", () => {
    expect(extractSubject("oidc/abc123")).toBe("abc123");
  });

  test("extracts subject from nested providerId", () => {
    expect(extractSubject("provider/tenant/user123")).toBe("user123");
  });

  test("handles single component providerId", () => {
    expect(extractSubject("subject")).toBe("subject");
  });

  test("returns undefined for undefined providerId", () => {
    expect(extractSubject(undefined)).toBeUndefined();
  });
});
