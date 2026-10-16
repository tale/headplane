import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { expect, inject, vi } from "vitest";

import { createHeadscale } from "~/server/headscale/api";
import { type AgentManager, createAgentManager } from "~/server/hp-agent";

import { startHeadscale } from "../setup/start-headscale";
import { createFaultProxy } from "./fault-proxy";

export const HOST_NAME = "headplane-agent";
export const AGENT_TAG = `tag:${HOST_NAME}`;

/**
 * Lists running agent processes. Each test run builds the agent into its own
 * temp path, so the command line identifies our processes exactly.
 */
export function agentPids() {
  const agentPath = inject("agentPath");
  const rows = execFileSync("ps", ["-A", "-o", "pid=,command="], { encoding: "utf8" });
  return rows
    .split("\n")
    .map((row) => row.trim().match(/^(\d+)\s+(.*)$/))
    .filter((match) => match?.[2] === agentPath)
    .map((match) => Number(match![1]));
}

export function agentProcessCount() {
  return agentPids().length;
}

export interface HarnessOptions {
  /** API key Headplane uses. Defaults to a valid admin key. */
  managerApiKey?: string;
}

export interface AgentOverrides {
  executablePath?: string;
  workDir?: string;
}

/**
 * A fresh Headscale plus a work dir for one agent identity. The agent can be
 * started and stopped repeatedly against the same work dir to exercise
 * restarts, and Headscale can be inspected, mutated, or cut off between runs.
 *
 * Headplane and the agent reach Headscale through a fault proxy. The test's
 * own view of Headscale (`api`) uses a separate key and connects directly, so
 * assertions keep working during an injected outage.
 *
 * Each harness owns its Headscale, so every node and auth key in it belongs
 * to the agent. Assertions count everything instead of filtering by name.
 */
export async function createHarness(version: string, options: HarnessOptions = {}) {
  const hs = await startHeadscale(version);
  const proxy = await createFaultProxy(new URL(hs.apiUrl));

  const inspectorKey = await createApiKey(hs.container);
  const inspector = await createHeadscale({ url: hs.apiUrl });
  const api = inspector.client(inspectorKey);

  const headscale = await createHeadscale({ url: proxy.url, retryIntervalMs: 500 });
  const managerApi = headscale.client(options.managerApiKey ?? hs.apiKey);
  const workDir = await mkdtemp(join(tmpdir(), "hp-agent-work-"));

  const managers = new Set<AgentManager>();

  /** Creates a manager without any guards. Returns undefined if it refuses. */
  async function createManager(overrides: AgentOverrides = {}) {
    const db = drizzle(":memory:");
    migrate(db, { migrationsFolder: "./drizzle" });

    // A long TTL keeps the background interval out of the way, so syncs
    // only happen when a scenario asks for one.
    const manager = await createAgentManager(
      {
        enabled: true,
        host_name: HOST_NAME,
        cache_ttl: 10 * 60_000,
        executable_path: overrides.executablePath ?? inject("agentPath"),
        work_dir: overrides.workDir ?? workDir,
        tailscale_netns: false,
      },
      proxy.url,
      managerApi,
      true,
      db,
    );

    if (manager) {
      managers.add(manager);
    }

    return manager;
  }

  async function startAgent() {
    expect(managers.size, "an agent manager is already running").toBe(0);
    expect(agentProcessCount(), "an agent process is already running").toBe(0);

    const manager = await createManager();
    if (!manager) {
      throw new Error("Agent manager failed to start");
    }

    return manager;
  }

  async function stopAgent() {
    for (const manager of managers) {
      await manager.dispose();
    }

    managers.clear();
    expect(agentProcessCount(), "dispose left an agent process running").toBe(0);
  }

  function signalAgent(signal: NodeJS.Signals) {
    const pids = agentPids();
    expect(pids, "expected exactly one agent process to signal").toHaveLength(1);
    process.kill(pids[0], signal);
  }

  async function nodes() {
    return api.nodes.list();
  }

  async function authKeys() {
    if (!api.preAuthKeys.listAll) {
      throw new Error(`Headscale ${version} can't list auth keys across users`);
    }

    return api.preAuthKeys.listAll();
  }

  /**
   * Asserts the steady state from Headscale's side: exactly one agent node,
   * online under the identity the manager reports, created from `keyCount`
   * auth keys that were all used, and exactly one agent process.
   */
  async function expectSettled(agent: AgentManager, keyCount: number) {
    const node = await vi.waitFor(
      async () => {
        const all = await nodes();
        expect(all).toHaveLength(1);
        expect(all[0].nodeKey).toBe(agent.agentNodeKey());
        expect(all[0].online).toBe(true);
        return all[0];
      },
      { timeout: 30_000, interval: 250 },
    );

    expect(node.givenName).toBe(HOST_NAME);
    expect(node.tags).toEqual([AGENT_TAG]);

    const keys = await authKeys();
    expect(keys).toHaveLength(keyCount);
    expect(keys.every((key) => key.used)).toBe(true);
    expect(agentProcessCount()).toBe(1);
    return node;
  }

  async function dispose() {
    // A stopped (SIGSTOP) agent ignores SIGTERM until it's resumed.
    for (const pid of agentPids()) {
      process.kill(pid, "SIGCONT");
    }

    proxy.setMode("up");
    await stopAgent();
    await proxy.close();
    await headscale.dispose();
    await inspector.dispose();
    await hs.container.stop({ remove: true, removeVolumes: true });
    await rm(workDir, { recursive: true, force: true });
  }

  return {
    api,
    proxy,
    workDir,
    createManager,
    startAgent,
    stopAgent,
    signalAgent,
    nodes,
    authKeys,
    expectSettled,
    dispose,
  };
}

async function createApiKey(container: Awaited<ReturnType<typeof startHeadscale>>["container"]) {
  const exec = await container.exec(["headscale", "apikeys", "create", "-o", "json"]);
  if (exec.exitCode !== 0) {
    throw new Error(`headscale apikeys create failed:\n${exec.stderr}`);
  }

  return JSON.parse(exec.stdout.toString()) as string;
}

/**
 * Waits until the agent reports a successful sync, failing with the agent's
 * own error or auth URL if it gets stuck. This only means the manager thinks
 * it's healthy; pair it with `expectSettled` to check Headscale agrees.
 */
export async function waitForSync(manager: AgentManager, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const sync = manager.lastSync();
    if (sync.syncedAt) {
      return sync;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const { error, authUrl, consecutiveErrors } = manager.lastSync();
  throw new Error(
    `Agent never synced (errors=${consecutiveErrors}, error=${error}, authUrl=${authUrl})`,
  );
}
