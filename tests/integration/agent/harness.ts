import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { inject } from "vitest";

import { createHeadscale } from "~/server/headscale/api";
import { type AgentManager, createAgentManager } from "~/server/hp-agent";

import { startHeadscale } from "../setup/start-headscale";

export const HOST_NAME = "headplane-agent";

/**
 * A fresh Headscale plus a work dir for one agent identity. The agent can be
 * started and stopped repeatedly against the same work dir to exercise
 * restarts, and Headscale can be inspected or mutated between runs.
 */
export async function createHarness(version: string) {
  const hs = await startHeadscale(version);
  const headscale = await createHeadscale({ url: hs.apiUrl });
  const api = headscale.client(hs.apiKey);
  const workDir = await mkdtemp(join(tmpdir(), "hp-agent-work-"));

  let manager: AgentManager | undefined;

  async function startAgent() {
    if (manager) {
      throw new Error("Agent is already running");
    }

    const db = drizzle(":memory:");
    migrate(db, { migrationsFolder: "./drizzle" });
    manager = await createAgentManager(
      {
        enabled: true,
        host_name: HOST_NAME,
        cache_ttl: 10 * 60_000,
        executable_path: inject("agentPath"),
        work_dir: workDir,
        tailscale_netns: false,
      },
      hs.apiUrl,
      api,
      true,
      db,
    );

    if (!manager) {
      throw new Error("Agent manager failed to start");
    }

    return manager;
  }

  async function stopAgent() {
    await manager?.dispose();
    manager = undefined;
  }

  async function agentNodes() {
    const nodes = await api.nodes.list();
    return nodes.filter((node) => node.givenName === HOST_NAME || node.name === HOST_NAME);
  }

  async function authKeys() {
    if (!api.preAuthKeys.listAll) {
      throw new Error(`Headscale ${version} can't list auth keys across users`);
    }

    return api.preAuthKeys.listAll();
  }

  async function dispose() {
    await stopAgent();
    await headscale.dispose();
    await hs.container.stop({ remove: true, removeVolumes: true });
    await rm(workDir, { recursive: true, force: true });
  }

  return { api, workDir, startAgent, stopAgent, agentNodes, authKeys, dispose };
}

/**
 * Waits until the agent reports a successful sync, failing with the agent's
 * own error or auth URL if it gets stuck.
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
