import { describe, expect, test } from "vitest";

import { isNoExpiry } from "~/utils/node-info";

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
