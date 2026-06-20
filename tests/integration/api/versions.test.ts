import { describe, expect, test } from "vitest";

import { gte } from "~/server/headscale/api/server-version";

import { getBootstrapClient, HS_VERSIONS, Version } from "../setup/env";

describe.for(HS_VERSIONS)("Headscale %s: Runtime Client", (version) => {
  test("the runtime client is usable", async () => {
    const bootstrapper = await getBootstrapClient(version);
    const runtimeClient = bootstrapper.client("test-api-key");
    expect(runtimeClient).toBeDefined();
  });

  test("the server version reported by /version matches the running container", async () => {
    const bootstrapper = await getBootstrapClient(version);
    expect(bootstrapper.version.unknown).toBe(false);
    const reported = `${bootstrapper.version.major}.${bootstrapper.version.minor}.${bootstrapper.version.patch}`;
    expect(reported).toBe(version);
  });

  test("capabilities are derived correctly from the detected version", async (context) => {
    const bootstrapper = await getBootstrapClient(version);
    const v = bootstrapper.version;
    expect(bootstrapper.capabilities.preAuthKeysHaveStableIds).toBe(gte(v, "0.28.0"));
    expect(bootstrapper.capabilities.nodeTagsAreFlat).toBe(gte(v, "0.28.0"));
    expect(bootstrapper.capabilities.nodeOwnerIsImmutable).toBe(gte(v, "0.28.0"));
    // If a future version is added to HS_VERSIONS before this test is
    // updated, surface that explicitly rather than passing silently.
    const known: Version[] = ["0.27.0", "0.27.1", "0.28.0", "0.29.0", "0.29.1"];
    if (!known.includes(version)) {
      context.skip();
    }
  });

  test("the health check endpoint works", async () => {
    const bootstrapper = await getBootstrapClient(version);
    const health = await bootstrapper.health();
    expect(health).toBe(true);
  });
});
