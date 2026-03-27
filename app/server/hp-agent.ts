import { execFile } from "node:child_process";
import { access, constants, mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { inArray, notInArray } from "drizzle-orm";
import { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";

import { HostInfo } from "~/types";
import log from "~/utils/log";

import { HeadplaneConfig } from "./config/config-schema";
import { ephemeralNodes, hostInfo } from "./db/schema";
import { RuntimeApiClient } from "./headscale/api/endpoints";

const execFileAsync = promisify(execFile);

export interface AgentManager {
  lookup(nodeKeys: string[]): Promise<Record<string, HostInfo>>;
  lastSync(): { syncedAt: Date | null; nodeCount: number; error?: string };
  agentNodeKey(): string | undefined;
  triggerSync(): Promise<void>;
  dispose(): void;
}

interface AgentOutput {
  self: string;
  hosts: Record<string, HostInfo>;
}

interface SyncState {
  syncedAt: Date | null;
  nodeCount: number;
  selfKey?: string;
  error?: string;
  isSyncing: boolean;
  pendingResync: boolean;
}

async function hasExistingState(workDir: string): Promise<boolean> {
  try {
    await stat(join(workDir, "tailscaled.state"));
    return true;
  } catch {
    return false;
  }
}

export async function createAgentManager(
  agentConfig: NonNullable<NonNullable<HeadplaneConfig["integration"]>["agent"]> | undefined,
  headscaleUrl: string,
  apiClient: RuntimeApiClient,
  supportsTagOnlyKeys: boolean,
  db: NodeSQLiteDatabase,
): Promise<AgentManager | undefined> {
  if (!agentConfig?.enabled) {
    return;
  }

  if (!supportsTagOnlyKeys) {
    log.error("agent", "The Headplane agent requires Headscale 0.28 or newer");
    log.error("agent", "The agent will not run without support for tag-only keys");
    return;
  }

  try {
    await access(agentConfig.executable_path, constants.X_OK);
  } catch {
    log.error("agent", "Agent executable not accessible at %s", agentConfig.executable_path);
    return;
  }

  try {
    await access(agentConfig.work_dir, constants.R_OK | constants.W_OK);
  } catch {
    try {
      await mkdir(agentConfig.work_dir, { recursive: true });
      log.info("agent", "Created agent work dir at %s", agentConfig.work_dir);
    } catch (innerError) {
      log.error(
        "agent",
        "Failed to create agent work dir at %s: %s",
        agentConfig.work_dir,
        innerError instanceof Error ? innerError.message : String(innerError),
      );
      return;
    }
  }

  const hostName = agentConfig.host_name ?? "headplane-agent";
  const cacheTtl = agentConfig.cache_ttl ?? 180_000;
  const executablePath = agentConfig.executable_path;
  const workDir = agentConfig.work_dir;

  const state: SyncState = {
    syncedAt: null,
    nodeCount: 0,
    isSyncing: false,
    pendingResync: false,
  };

  async function generateAuthKey(): Promise<string> {
    const expiration = new Date(Date.now() + 5 * 60_000);
    const pak = await apiClient.createPreAuthKey(null, false, false, expiration, [
      `tag:${hostName}`,
    ]);
    return pak.key;
  }

  async function runAgent(authKey: string): Promise<string> {
    const env: Record<string, string> = {
      HOME: process.env.HOME ?? "",
      HEADPLANE_AGENT_WORK_DIR: workDir,
      HEADPLANE_AGENT_TS_SERVER: headscaleUrl,
      HEADPLANE_AGENT_HOSTNAME: hostName,
      HEADPLANE_AGENT_DEBUG: log.debugEnabled ? "true" : "false",
    };

    if (authKey) {
      env.HEADPLANE_AGENT_TS_AUTHKEY = authKey;
    }

    const { stdout } = await execFileAsync(executablePath, [], {
      timeout: 60_000,
      env,
    });

    return stdout;
  }

  async function sync() {
    if (state.isSyncing) {
      state.pendingResync = true;
      log.debug("agent", "Sync already in progress, queued resync");
      return;
    }

    state.isSyncing = true;
    try {
      const stateExists = await hasExistingState(workDir);
      const authKey = stateExists ? "" : await generateAuthKey();

      if (stateExists) {
        log.debug("agent", "Reusing existing tsnet identity");
      }

      let stdout: string;
      try {
        stdout = await runAgent(authKey);
      } catch (err) {
        if (stateExists) {
          log.info("agent", "Agent failed with existing state, clearing and retrying");
          await rm(join(workDir, "tailscaled.state"), { force: true });
          const freshKey = await generateAuthKey();
          stdout = await runAgent(freshKey);
        } else {
          throw err;
        }
      }

      const output = JSON.parse(stdout) as AgentOutput;
      const keys = Object.keys(output.hosts);

      for (const [nodeKey, payload] of Object.entries(output.hosts)) {
        await db
          .insert(hostInfo)
          .values({
            host_id: nodeKey,
            payload,
            updated_at: new Date(),
          })
          .onConflictDoUpdate({
            target: hostInfo.host_id,
            set: {
              payload,
              updated_at: new Date(),
            },
          });
      }

      await pruneStaleHostInfo();
      await pruneEphemeralNodes();

      state.syncedAt = new Date();
      state.nodeCount = keys.length;
      state.selfKey = output.self || undefined;
      state.error = undefined;

      log.info("agent", "Sync complete: %d nodes updated", keys.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.error = message;
      log.error("agent", "Sync failed: %s", message);
    } finally {
      state.isSyncing = false;
      if (state.pendingResync) {
        state.pendingResync = false;
        sync();
      }
    }
  }

  async function pruneStaleHostInfo() {
    try {
      const nodes = await apiClient.getNodes();
      const activeKeys = nodes.map((n) => n.nodeKey);

      if (activeKeys.length === 0) {
        return;
      }

      const deleted = await db
        .delete(hostInfo)
        .where(notInArray(hostInfo.host_id, activeKeys))
        .returning();

      if (deleted.length > 0) {
        log.info("agent", "Pruned %d stale hostinfo entries", deleted.length);
      }
    } catch (error) {
      log.debug(
        "agent",
        "Failed to prune stale hostinfo: %s",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async function pruneEphemeralNodes() {
    try {
      const rows = await db.select().from(ephemeralNodes);
      if (rows.length === 0) {
        return;
      }

      const nodes = await apiClient.getNodes();
      const activeKeys = new Set(nodes.map((n) => n.nodeKey));

      for (const row of rows) {
        if (!row.node_key) {
          continue;
        }

        if (!activeKeys.has(row.node_key)) {
          await db.delete(ephemeralNodes).where(inArray(ephemeralNodes.auth_key, [row.auth_key]));
          log.info("agent", "Pruned ephemeral SSH node %s", row.node_key);
        }
      }
    } catch (error) {
      log.debug(
        "agent",
        "Failed to prune ephemeral nodes: %s",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  sync();

  const interval = setInterval(() => {
    sync();
  }, cacheTtl);

  return {
    async lookup(nodeKeys) {
      if (nodeKeys.length === 0) {
        return {};
      }

      const results = await db.select().from(hostInfo).where(inArray(hostInfo.host_id, nodeKeys));

      return Object.fromEntries(
        results.filter((r) => r.payload).map((r) => [r.host_id, r.payload]),
      ) as Record<string, HostInfo>;
    },

    lastSync() {
      return {
        syncedAt: state.syncedAt,
        nodeCount: state.nodeCount,
        error: state.error,
      };
    },

    agentNodeKey() {
      return state.selfKey;
    },

    async triggerSync() {
      await sync();
    },

    dispose() {
      clearInterval(interval);
    },
  };
}
