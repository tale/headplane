import { describe, expect, test } from "vitest";

import { extractTagOwnerTags, isNoExpiry, sortAssignableTags } from "~/utils/node-info";

describe("isNoExpiry", () => {
  test("returns true for null", () => {
    expect(isNoExpiry(null)).toBe(true);
  });

  test("returns true for undefined", () => {
    expect(isNoExpiry(undefined)).toBe(true);
  });

  test("returns true for Go zero-time ISO format", () => {
    expect(isNoExpiry("0001-01-01T00:00:00Z")).toBe(true);
  });

  test("returns true for Go zero-time space format", () => {
    expect(isNoExpiry("0001-01-01 00:00:00")).toBe(true);
  });

  test("returns false for a real future expiry", () => {
    expect(isNoExpiry("2030-01-01T00:00:00Z")).toBe(false);
  });

  test("returns false for a real past expiry", () => {
    expect(isNoExpiry("2020-01-01T00:00:00Z")).toBe(false);
  });
});

describe("extractTagOwnerTags", () => {
  test("reads tags from HuJSON tagOwners", () => {
    expect(
      extractTagOwnerTags(`{
        // comment
        "tagOwners": {
          "tag:prod": ["group:admins"],
          "tag:server": [],
        },
      }`),
    ).toEqual(["tag:prod", "tag:server"]);
  });

  test("ignores invalid policies", () => {
    expect(extractTagOwnerTags("not-json")).toEqual([]);
  });
});

describe("sortAssignableTags", () => {
  test("unions assigned node tags with ACL tag owners", () => {
    expect(
      sortAssignableTags(
        [
          {
            id: "1",
            givenName: "node",
            name: "node",
            machineKey: "mkey:test",
            nodeKey: "nodekey:test",
            discoKey: "discokey:test",
            ipAddresses: [],
            tags: ["tag:used"],
            lastSeen: "",
            expiry: null,
            online: true,
            registerMethod: "REGISTER_METHOD_AUTH_KEY",
            createdAt: "",
            availableRoutes: [],
            approvedRoutes: [],
            subnetRoutes: [],
          },
        ],
        '{"tagOwners":{"tag:declared":[]}}',
      ),
    ).toEqual(["tag:declared", "tag:used"]);
  });
});
