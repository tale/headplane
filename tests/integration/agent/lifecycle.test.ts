import { afterEach, describe, expect, test } from "vitest";

import { createHarness, waitForSync } from "./harness";

const HS_VERSIONS = ["0.28.0", "0.29.5"];

describe.each(HS_VERSIONS)("agent lifecycle on Headscale %s", (version) => {
  let harness: Awaited<ReturnType<typeof createHarness>> | undefined;

  afterEach(async () => {
    await harness?.dispose();
    harness = undefined;
  });

  test("first run registers one node with one auth key", async () => {
    harness = await createHarness(version);

    await waitForSync(await harness.startAgent());

    const nodes = await harness.agentNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].tags).toContain("tag:headplane-agent");
    expect(await harness.authKeys()).toHaveLength(1);
  });

  test("restart reuses the node without creating an auth key", async () => {
    harness = await createHarness(version);

    await waitForSync(await harness.startAgent());
    const [node] = await harness.agentNodes();
    const keyCount = (await harness.authKeys()).length;
    await harness.stopAgent();

    await waitForSync(await harness.startAgent());

    const nodes = await harness.agentNodes();
    expect(nodes.map((n) => n.id)).toEqual([node.id]);
    expect(await harness.authKeys()).toHaveLength(keyCount);
  });
});
