import { type ChildProcess, spawn } from "node:child_process";
import { access, constants, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";

import { inArray, notInArray } from "drizzle-orm";

import { HostInfo } from "~/types";
import log from "~/utils/log";

import { HeadplaneConfig } from "./config/config-schema";
import type { HeadplaneDb } from "./db/client.server";
import type { HeadscaleClient } from "./headscale/api";

export interface AgentManager {
  lookup(nodeKeys: string[]): Promise<Record<string, HostInfo>>;
  lastSync(): {
    syncedAt: Date | null;
    nodeCount: number;
    error?: string;
    authUrl?: string;
  };
  agentNodeKey(): string | undefined;
  triggerSync(): Promise<void>;
  dispose(): void;
}

interface AgentOutput {
  self: string;
  hosts: Record<string, HostInfo>;
  error?: string;
}

interface SyncState {
  syncedAt: Date | null;
  nodeCount: number;
  selfKey?: string;
  error?: string;
  authUrl?: string;
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
  apiClient: HeadscaleClient,
  supportsTagOnlyKeys: boolean,
  headplaneDb: HeadplaneDb,
): Promise<AgentManager | undefined> {
  const { client: db, tables } = headplaneDb;

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
  };

  let proc: ChildProcess | null = null;
  let responseHandler: ((line: string) => void) | null = null;
  let disposed = false;
  let consecutiveErrors = 0;
  let approvingAuthId: string | undefined;

  async function generateAuthKey(): Promise<string> {
    const expiration = new Date(Date.now() + 5 * 60_000);
    const pak = await apiClient.preAuthKeys.create({
      user: null,
      ephemeral: false,
      reusable: false,
      expiration,
      aclTags: [`tag:${hostName}`],
    });
    return pak.key;
  }

  function spawnAgent(authKey: string): ChildProcess {
    const env: Record<string, string> = {
      HOME: process.env.HOME ?? "",
      HEADPLANE_AGENT_WORK_DIR: workDir,
      HEADPLANE_AGENT_TS_SERVER: headscaleUrl,
      HEADPLANE_AGENT_HOSTNAME: hostName,
      HEADPLANE_AGENT_DEBUG: log.debugEnabled ? "true" : "false",
    };

    if (authKey) {
      env.HEADPLANE_AGENT_TS_AUTHKEY = authKey;
      log.info("agent", "Spawning agent with pre-auth key (prefix: %s)", authKey.slice(0, 16));
    } else {
      log.info("agent", "Spawning agent without pre-auth key (reusing existing state)");
    }

    const child = spawn(executablePath, [], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (!text) {
        return;
      }

      log.debug("agent", "%s", text);

      // tsnet prints an auth URL when it falls back to interactive login.
      // Capture it so the UI can surface the approval link if needed, and try
      // to auto-approve the agent using Headplane's admin API access.
      const authMatch = text.match(
        /To start this tsnet server, restart with TS_AUTHKEY set, or go to: (https:\/\/\S+)/,
      );
      if (authMatch) {
        state.authUrl = authMatch[1];
        log.warn("agent", "Agent is waiting for interactive approval; visit: %s", state.authUrl);

        const authId = state.authUrl.split("/").pop();
        if (authId && authId !== approvingAuthId) {
          approvingAuthId = authId;
          log.info("agent", "Attempting to auto-approve auth request %s", authId);
          apiClient.auth
            .approve(authId)
            .then(() => {
              log.info("agent", "Auto-approved auth request %s", authId);
            })
            .catch((error) => {
              log.warn(
                "agent",
                "Failed to auto-approve auth request %s: %s",
                authId,
                error instanceof Error ? error.message : String(error),
              );
            });
        }
      }
    });

    const rl = createInterface({ input: child.stdout! });
    rl.on("line", (line) => {
      if (responseHandler) {
        const handler = responseHandler;
        responseHandler = null;
        handler(line);
      }
    });

    child.on("exit", (code, signal) => {
      if (!disposed) {
        log.warn("agent", "Agent process exited (code=%s, signal=%s)", code, signal);
      } else {
        log.info(
          "agent",
          "Agent process exited during disposal (code=%s, signal=%s)",
          code,
          signal,
        );
      }
      proc = null;

      // Reject any pending sync request
      if (responseHandler) {
        const handler = responseHandler;
        responseHandler = null;
        handler("");
      }
    });

    proc = child;
    return child;
  }

  async function ensureProcess(): Promise<ChildProcess> {
    if (proc && proc.exitCode === null) {
      return proc;
    }

    const stateExists = await hasExistingState(workDir);
    const authKey = await generateAuthKey();
    if (stateExists) {
      log.debug("agent", "Reusing existing tsnet identity");
      log.info(
        "agent",
        "Existing state found; agent will use it and fall back to the pre-auth key if needed",
      );
    } else {
      log.info("agent", "No tsnet state found, agent will register with a pre-auth key");
    }

    return spawnAgent(authKey);
  }

  function sendSync(child: ChildProcess): Promise<string> {
    return new Promise((resolve) => {
      responseHandler = resolve;
      child.stdin?.write("sync\n");
    });
  }

  async function requestSync(child: ChildProcess): Promise<AgentOutput> {
    const line = await sendSync(child);
    if (!line) {
      throw new Error("Agent process closed unexpectedly");
    }
    return JSON.parse(line) as AgentOutput;
  }

  let isSyncing = false;
  let pendingResync = false;

  async function sync() {
    if (isSyncing) {
      pendingResync = true;
      log.debug("agent", "Sync already in progress, queued resync");
      return;
    }

    isSyncing = true;
    try {
      const child = await ensureProcess();
      const output = await requestSync(child);

      if (output.error) {
        consecutiveErrors++;
        state.error = output.error;
        log.error("agent", "Sync error from agent (%d/5): %s", consecutiveErrors, output.error);

        if (consecutiveErrors >= 5 && proc) {
          log.warn("agent", "Too many consecutive errors, killing agent process for retry");
          proc.kill("SIGTERM");
          proc = null;
        }
        return;
      }

      consecutiveErrors = 0;
      const keys = Object.keys(output.hosts);

      for (const [nodeKey, payload] of Object.entries(output.hosts)) {
        await db
          .insert(tables.hostInfo)
          .values({
            host_id: nodeKey,
            payload,
            updated_at: new Date(),
          })
          .onConflictDoUpdate({
            target: tables.hostInfo.host_id,
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
      consecutiveErrors++;
      const message = error instanceof Error ? error.message : String(error);
      state.error = message;
      log.error("agent", "Sync failed (%d/5): %s", consecutiveErrors, message);

      if (consecutiveErrors >= 5) {
        log.warn(
          "agent",
          "Too many consecutive failures; agent state is being preserved to avoid creating a new host",
        );
      }
    } finally {
      isSyncing = false;
      if (pendingResync) {
        pendingResync = false;
        sync();
      }
    }
  }

  /**
   * Prunes any offline nodes marked as ephemeral. This is due to a Headscale
   * bug where ephemeral nodes wouldn't be automatically removed on disconnect.
   */
  async function pruneStaleHostInfo() {
    try {
      const nodes = await apiClient.nodes.list();
      const activeKeys = nodes.map((n) => n.nodeKey);

      if (activeKeys.length === 0) {
        return;
      }

      const deleted = await db
        .delete(tables.hostInfo)
        .where(notInArray(tables.hostInfo.host_id, activeKeys))
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
      const nodes = await apiClient.nodes.list();
      const toPrune = nodes.filter((n) => n.preAuthKey?.ephemeral && !n.online);

      for (const node of toPrune) {
        await apiClient.nodes.delete(node.id);
        log.info("agent", "Pruned offline ephemeral node %s", node.givenName);
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

      const results = await db
        .select()
        .from(tables.hostInfo)
        .where(inArray(tables.hostInfo.host_id, nodeKeys));

      return Object.fromEntries(
        results.filter((r) => r.payload).map((r) => [r.host_id, r.payload]),
      ) as Record<string, HostInfo>;
    },

    lastSync() {
      return {
        syncedAt: state.syncedAt,
        nodeCount: state.nodeCount,
        error: state.error,
        authUrl: state.authUrl,
      };
    },

    agentNodeKey() {
      return state.selfKey;
    },

    async triggerSync() {
      await sync();
    },

    dispose() {
      disposed = true;
      clearInterval(interval);
      if (proc) {
        proc.kill("SIGTERM");
        proc = null;
      }
    },
  };
}
