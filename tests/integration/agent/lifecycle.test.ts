import { afterEach, describe, expect, test, vi } from "vitest";

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

    const agent = await harness.startAgent();
    await waitForSync(agent);

    await harness.expectSettled(agent, 1);
  });

  test("restart reuses the node without creating an auth key", async () => {
    harness = await createHarness(version);

    let agent = await harness.startAgent();
    await waitForSync(agent);
    const node = await harness.expectSettled(agent, 1);
    await harness.stopAgent();

    agent = await harness.startAgent();
    await waitForSync(agent);

    const after = await harness.expectSettled(agent, 1);
    expect(after.id).toBe(node.id);
    expect(after.nodeKey).toBe(node.nodeKey);
  });

  test("repeated restarts keep a single node and auth key", async () => {
    harness = await createHarness(version);

    let agent = await harness.startAgent();
    await waitForSync(agent);
    const node = await harness.expectSettled(agent, 1);

    for (let i = 0; i < 5; i++) {
      await harness.stopAgent();
      agent = await harness.startAgent();
      await waitForSync(agent);
    }

    const after = await harness.expectSettled(agent, 1);
    expect(after.id).toBe(node.id);
  });

  test("restart re-registers when the node was deleted while stopped", async () => {
    harness = await createHarness(version);

    let agent = await harness.startAgent();
    await waitForSync(agent);
    const node = await harness.expectSettled(agent, 1);
    await harness.stopAgent();
    await harness.api.nodes.delete(node.id);

    agent = await harness.startAgent();
    await waitForSync(agent);

    const after = await harness.expectSettled(agent, 2);
    expect(after.id).not.toBe(node.id);
  });

  test("a running agent re-registers when its node is deleted", async () => {
    harness = await createHarness(version);

    const agent = await harness.startAgent();
    await waitForSync(agent);
    const node = await harness.expectSettled(agent, 1);
    await harness.api.nodes.delete(node.id);

    // tsnet keeps its node key when it re-registers.
    await agent.triggerSync();
    await vi.waitFor(
      async () => {
        const ids = (await harness!.nodes()).map((n) => n.id);
        expect(ids).toHaveLength(1);
        expect(ids[0]).not.toBe(node.id);
      },
      { timeout: 60_000, interval: 250 },
    );

    const after = await harness.expectSettled(agent, 2);
    expect(after.id).not.toBe(node.id);
  });
});
