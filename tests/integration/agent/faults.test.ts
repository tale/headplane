import { chmod, copyFile, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { afterEach, describe, expect, inject, test, vi } from "vitest";

import type { AgentManager } from "~/server/hp-agent";

import { agentPids, agentProcessCount, createHarness, waitForSync } from "./harness";

const HS_VERSIONS = ["0.28.0", "0.29.5"];

const SYNC_DEADLINE_MS = 45_000;

async function syncWithin(agent: AgentManager, ms: number) {
  const outcome = await Promise.race([
    agent.triggerSync().then(() => "settled" as const),
    sleep(ms).then(() => "hung" as const),
  ]);

  expect(outcome, `sync didn't settle within ${ms}ms`).toBe("settled");
}

async function waitForNextSync(agent: AgentManager, after: Date) {
  await vi.waitFor(
    () => {
      const { syncedAt } = agent.lastSync();
      expect(syncedAt?.getTime() ?? 0).toBeGreaterThan(after.getTime());
    },
    { timeout: 60_000, interval: 250 },
  );
}

async function expectAtMostProcesses(max: number, ms: number) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    expect(agentProcessCount()).toBeLessThanOrEqual(max);
    await sleep(100);
  }
}

describe.each(HS_VERSIONS)("agent faults on Headscale %s", (version) => {
  let harness: Awaited<ReturnType<typeof createHarness>> | undefined;

  afterEach(async () => {
    await harness?.dispose();
    harness = undefined;
  });

  test("Headscale down at startup reports an error, then recovers", async () => {
    harness = await createHarness(version);
    harness.proxy.setMode("down");

    const agent = await harness.startAgent();
    await vi.waitFor(() => expect(agent.lastSync().consecutiveErrors).toBeGreaterThan(0), {
      timeout: 30_000,
    });

    expect(agent.lastSync().syncedAt).toBeNull();
    expect(agent.lastSync().error).toMatch(/reach Headscale/);
    expect(agentProcessCount()).toBe(0);
    expect(await harness.nodes()).toHaveLength(0);
    expect(await harness.authKeys()).toHaveLength(0);

    harness.proxy.setMode("up");
    await agent.triggerSync();
    await waitForSync(agent);
    await harness.expectSettled(agent, 1);
  });

  test("a Headscale outage while running reports an error, then recovers", async () => {
    harness = await createHarness(version);
    const agent = await harness.startAgent();
    const { syncedAt } = await waitForSync(agent);
    const node = await harness.expectSettled(agent, 1);

    harness.proxy.setMode("down");
    await syncWithin(agent, SYNC_DEADLINE_MS);
    expect(agent.lastSync().error).toMatch(/reach Headscale/);
    expect(agent.lastSync().syncedAt).toEqual(syncedAt);
    expect(agentProcessCount()).toBe(1);

    harness.proxy.setMode("up");
    await agent.triggerSync();
    await waitForNextSync(agent, syncedAt!);

    const after = await harness.expectSettled(agent, 1);
    expect(after.id).toBe(node.id);
  });

  test("a hung Headscale fails the sync instead of blocking it", async () => {
    harness = await createHarness(version);
    const agent = await harness.startAgent();
    const { syncedAt } = await waitForSync(agent);
    const node = await harness.expectSettled(agent, 1);

    harness.proxy.setMode("blackhole");
    await syncWithin(agent, SYNC_DEADLINE_MS);
    expect(agent.lastSync().error).toMatch(/Headscale didn't .* in time/);
    expect(agent.lastSync().syncedAt).toEqual(syncedAt);

    harness.proxy.setMode("up");
    await agent.triggerSync();
    await waitForNextSync(agent, syncedAt!);
    expect((await harness.nodes()).map((n) => n.id)).toEqual([node.id]);
    expect(await harness.authKeys()).toHaveLength(1);
  });

  test("a hung Headscale during registration blames Headscale", async () => {
    harness = await createHarness(version);
    harness.proxy.setMode("blackhole");

    const agent = await harness.startAgent();
    await vi.waitFor(() => expect(agent.lastSync().error).toBeTruthy(), {
      timeout: SYNC_DEADLINE_MS,
    });

    expect(agent.lastSync().error).toBe("Headscale didn't create an auth key in time");
    expect(agentProcessCount()).toBe(0);

    harness.proxy.setMode("up");
    await agent.triggerSync();
    await waitForSync(agent);
    expect(await harness.nodes()).toHaveLength(1);
  });

  test("a killed agent comes back on its own without re-registering", async () => {
    harness = await createHarness(version);
    const agent = await harness.startAgent();
    const { syncedAt } = await waitForSync(agent);
    const node = await harness.expectSettled(agent, 1);

    harness.signalAgent("SIGKILL");
    await waitForNextSync(agent, syncedAt!);

    const after = await harness.expectSettled(agent, 1);
    expect(after.id).toBe(node.id);
  });

  test("a hung agent is replaced on its own without re-registering", async () => {
    harness = await createHarness(version);
    const agent = await harness.startAgent();
    const { syncedAt } = await waitForSync(agent);
    const node = await harness.expectSettled(agent, 1);

    harness.signalAgent("SIGSTOP");
    await syncWithin(agent, SYNC_DEADLINE_MS);
    expect(agent.lastSync().error).toBeTruthy();

    await waitForNextSync(agent, syncedAt!);

    const after = await harness.expectSettled(agent, 1);
    expect(after.id).toBe(node.id);
  });

  test("corrupt agent state re-registers instead of crash looping", async () => {
    harness = await createHarness(version);
    let agent = await harness.startAgent();
    await waitForSync(agent);
    const node = await harness.expectSettled(agent, 1);
    await harness.stopAgent();

    await writeFile(join(harness.workDir, "tailscaled.state"), "not json");

    agent = await harness.startAgent();
    await waitForSync(agent);

    const after = await harness.expectSettled(agent, 2);
    expect(after.id).not.toBe(node.id);

    const files = await readdir(harness.workDir);
    expect(files.some((file) => file.startsWith("tailscaled.state.corrupt-"))).toBe(true);
  });

  test("re-registering never removes another agent's node", async () => {
    harness = await createHarness(version);
    const agent = await harness.startAgent();
    await waitForSync(agent);
    const node = await harness.expectSettled(agent, 1);

    const otherDir = await mkdtemp(join(tmpdir(), "hp-agent-other-"));
    try {
      const other = await harness.createManager({ workDir: otherDir });
      await waitForSync(other!);
      const otherNode = (await harness.nodes()).find((n) => n.nodeKey === other!.agentNodeKey());
      expect(otherNode).toBeDefined();

      await agent.dispose();
      await writeFile(join(harness.workDir, "tailscaled.state"), "not json");
      const replacement = await harness.createManager();
      await waitForSync(replacement!);

      const ids = (await harness.nodes()).map((n) => n.id);
      const replacementNode = (await harness.nodes()).find(
        (n) => n.nodeKey === replacement!.agentNodeKey(),
      );

      expect(ids).toHaveLength(2);
      expect(ids).toContain(otherNode!.id);
      expect(ids).toContain(replacementNode!.id);
      expect(ids).not.toContain(node.id);
    } finally {
      await harness.stopAgent();
      await rm(otherDir, { recursive: true, force: true });
    }
  });

  test("a second manager on the same work dir waits, then takes over", async () => {
    harness = await createHarness(version);
    const agent = await harness.startAgent();
    await waitForSync(agent);
    const node = await harness.expectSettled(agent, 1);

    const second = await harness.createManager();
    expect(second).toBeDefined();
    await Promise.all([second!.triggerSync(), expectAtMostProcesses(1, 10_000)]);
    expect(second!.lastSync().syncedAt).toBeNull();

    await agent.dispose();
    await waitForSync(second!);

    const after = await harness.expectSettled(second!, 1);
    expect(after.id).toBe(node.id);
  });

  test("disposing a waiting manager keeps the work dir with its owner", async () => {
    harness = await createHarness(version);
    const agent = await harness.startAgent();
    await waitForSync(agent);
    const node = await harness.expectSettled(agent, 1);

    const abandoned = await harness.createManager();
    await abandoned!.dispose();

    const third = await harness.createManager();
    await Promise.all([third!.triggerSync(), expectAtMostProcesses(1, 10_000)]);
    expect(third!.lastSync().syncedAt).toBeNull();

    await agent.dispose();
    await waitForSync(third!);

    const after = await harness.expectSettled(third!, 1);
    expect(after.id).toBe(node.id);
  });

  test("shutting down while a restart reads its state never leaves an agent", async () => {
    harness = await createHarness(version);
    const agent = await harness.startAgent();
    await waitForSync(agent);
    await harness.expectSettled(agent, 1);
    await harness.stopAgent();

    const restarted = await harness.createManager();
    await restarted!.dispose();

    await expectAtMostProcesses(0, 5_000);
  });

  test("shutting down mid-sync never leaves an agent running", async () => {
    harness = await createHarness(version);
    harness.proxy.setLatency(3_000);

    await harness.createManager();
    await sleep(500);
    await harness.stopAgent();

    harness.proxy.setLatency(0);
    await expectAtMostProcesses(0, 8_000);
    expect(await harness.nodes()).toHaveLength(0);
  });

  test("concurrent sync requests start a single agent", async () => {
    harness = await createHarness(version);
    const agent = await harness.startAgent();

    await Promise.all(Array.from({ length: 10 }, () => agent.triggerSync()));
    await waitForSync(agent);

    await harness.expectSettled(agent, 1);
  });

  test("an invalid API key reports an error and starts nothing", async () => {
    harness = await createHarness(version, { managerApiKey: "hskey-api-invalid-0000" });
    const agent = await harness.startAgent();

    await vi.waitFor(() => expect(agent.lastSync().consecutiveErrors).toBeGreaterThan(0), {
      timeout: 30_000,
    });

    expect(agent.lastSync().syncedAt).toBeNull();
    expect(agent.lastSync().error).toBeTruthy();
    expect(agent.lastSync().error).not.toContain("[object Object]");
    expect(agentProcessCount()).toBe(0);
    expect(await harness.nodes()).toHaveLength(0);
    expect(await harness.authKeys()).toHaveLength(0);
  });

  test("an agent binary that vanishes reports an error, then recovers", async () => {
    harness = await createHarness(version);
    const binDir = await mkdtemp(join(tmpdir(), "hp-agent-bin-copy-"));
    const binary = join(binDir, "hp_agent");
    await copyFile(inject("agentPath"), binary);
    await chmod(binary, 0o755);

    try {
      const agent = await harness.createManager({ executablePath: binary });
      const { syncedAt } = await waitForSync(agent!);

      await rename(binary, `${binary}.moved`);
      harness.signalAgent("SIGKILL", binary);
      await vi.waitFor(() => expect(agent!.lastSync().consecutiveErrors).toBeGreaterThan(0), {
        timeout: 30_000,
      });

      await rename(`${binary}.moved`, binary);
      await waitForNextSync(agent!, syncedAt!);

      expect(agentPids(binary)).toHaveLength(1);
      expect(await harness.nodes()).toHaveLength(1);
      expect(await harness.authKeys()).toHaveLength(1);
    } finally {
      await harness.stopAgent();
      await rm(binDir, { recursive: true, force: true });
    }
  });

  test("a missing agent executable refuses to start", async () => {
    harness = await createHarness(version);

    const agent = await harness.createManager({ executablePath: "/nonexistent/hp_agent" });

    expect(agent).toBeUndefined();
    expect(await harness.authKeys()).toHaveLength(0);
  });

  test("an unwritable work dir refuses to start", async () => {
    harness = await createHarness(version);
    const workDir = await mkdtemp(join(tmpdir(), "hp-agent-readonly-"));
    await chmod(workDir, 0o500);

    try {
      const agent = await harness.createManager({ workDir });
      expect(agent).toBeUndefined();
      expect(agentProcessCount()).toBe(0);
      expect(await harness.authKeys()).toHaveLength(0);
    } finally {
      await chmod(workDir, 0o700);
      await rm(workDir, { recursive: true, force: true });
    }
  });
});
