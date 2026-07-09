import { describe, expect, test } from "vitest";

import { capabilitiesFor } from "~/server/headscale/api/capabilities";
import {
  formatServerVersion,
  gte,
  parseServerVersion,
} from "~/server/headscale/api/server-version";

describe("parseServerVersion", () => {
  test("parses release versions with and without a leading v", () => {
    expect(parseServerVersion("0.28.0")).toMatchObject({
      major: 0,
      minor: 28,
      patch: 0,
      prerelease: undefined,
      unknown: false,
    });
    expect(parseServerVersion("v0.27.1")).toMatchObject({
      major: 0,
      minor: 27,
      patch: 1,
      unknown: false,
    });
  });

  test("captures prerelease and build metadata", () => {
    const v = parseServerVersion("v0.28.0-beta.1+abcdef");
    expect(v.major).toBe(0);
    expect(v.minor).toBe(28);
    expect(v.patch).toBe(0);
    expect(v.prerelease).toBe("beta.1");
    expect(v.build).toBe("abcdef");
    expect(v.unknown).toBe(false);
  });

  test("flags unparseable versions (e.g. dev builds)", () => {
    const v = parseServerVersion("dev");
    expect(v.unknown).toBe(true);
    expect(v.raw).toBe("dev");
  });

  test("flags Go pseudo-versions from untagged builds as unknown", () => {
    // Headscale's per-commit Docker images (main-*, development) report a
    // Go pseudo-version instead of `dev`. Parsing it as semver 0.0.0 would
    // deny every capability to a server running the newest code.
    const v = parseServerVersion("v0.0.0-20260703052708-048308511c72");
    expect(v.unknown).toBe(true);
    expect(v.raw).toBe("v0.0.0-20260703052708-048308511c72");
  });

  test("does not flag a genuine 0.0.0 prerelease as unknown", () => {
    const v = parseServerVersion("v0.0.0-beta.1");
    expect(v.unknown).toBe(false);
    expect(v.prerelease).toBe("beta.1");
  });
});

describe("gte", () => {
  test("compares plain versions correctly", () => {
    const v = parseServerVersion("0.28.0");
    expect(gte(v, "0.27.0")).toBe(true);
    expect(gte(v, "0.28.0")).toBe(true);
    expect(gte(v, "0.29.0")).toBe(false);
  });

  test("ignores prerelease tags so betas get modern capabilities", () => {
    // 0.28.0-beta.1 ships every wire format change that 0.28.0 does, so
    // strict semver (where 0.28.0-beta.1 < 0.28.0) would lock beta users
    // out of features their server actually supports.
    const beta = parseServerVersion("0.28.0-beta.1");
    expect(gte(beta, "0.28.0")).toBe(true);
    expect(gte(beta, "0.27.0")).toBe(true);
  });

  test("unknown versions are treated as the newest known release", () => {
    const dev = parseServerVersion("dev");
    expect(gte(dev, "9.9.9")).toBe(true);
  });
});

describe("formatServerVersion", () => {
  test("renders release and prerelease versions without a leading v", () => {
    expect(formatServerVersion(parseServerVersion("v0.28.0"))).toBe("0.28.0");
    expect(formatServerVersion(parseServerVersion("0.28.0-beta.1"))).toBe("0.28.0-beta.1");
  });

  test("falls back to the raw string for unknown versions", () => {
    expect(formatServerVersion(parseServerVersion("dev"))).toBe("dev");
  });
});

describe("capabilitiesFor", () => {
  test("0.28.0 enables every modern flag", () => {
    const caps = capabilitiesFor(parseServerVersion("0.28.0"));
    expect(caps).toEqual({
      preAuthKeysHaveStableIds: true,
      nodeTagsAreFlat: true,
      nodeOwnerIsImmutable: true,
      registerKeyIncludesAuthReqPrefix: false,
    });
  });

  test("0.28.0-beta.1 matches 0.28.0 capabilities (prerelease gating)", () => {
    expect(capabilitiesFor(parseServerVersion("0.28.0-beta.1"))).toEqual(
      capabilitiesFor(parseServerVersion("0.28.0")),
    );
  });

  test("0.29.0 enables the prefixed AuthID register key", () => {
    const caps = capabilitiesFor(parseServerVersion("0.29.0"));
    expect(caps.registerKeyIncludesAuthReqPrefix).toBe(true);
  });

  test("0.27.1 lacks every 0.28-gated capability", () => {
    const caps = capabilitiesFor(parseServerVersion("0.27.1"));
    expect(caps.preAuthKeysHaveStableIds).toBe(false);
    expect(caps.nodeTagsAreFlat).toBe(false);
    expect(caps.nodeOwnerIsImmutable).toBe(false);
    expect(caps.registerKeyIncludesAuthReqPrefix).toBe(false);
  });
});
