import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { access, constants, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

import { inArray, notInArray } from "drizzle-orm";
import { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";

import { HostInfo, type Machine } from "~/types";
import log from "~/utils/log";

import { HeadplaneConfig } from "./config/config-schema";
import { hostInfo } from "./db/schema";
import type { HeadscaleClient } from "./headscale/api";
import { headscaleErrorMessage } from "./headscale/api/error-client";

export interface AgentManager {
  lookup(nodeKeys: string[]): Promise<Record<string, HostInfo>>;
  lastSync(): {
    syncedAt: Date | null;
    nodeCount: number;
    syncedKeys: string[];
    intervalMs: number;
    consecutiveErrors: number;
    startedAt?: Date;
    error?: string;
    authUrl?: string;
  };
  lastUpdated(nodeKeys: string[]): Promise<Record<string, Date>>;
  agentNodeKey(): string | undefined;
  triggerSync(): Promise<void>;
  dispose(): Promise<void>;
}

interface AgentOutput {
  self: string;
  hosts: Record<string, HostInfo>;
  error?: string;
}

interface SyncState {
  syncedAt: Date | null;
  nodeCount: number;
  syncedKeys: string[];
  startedAt?: Date;
  selfKey?: string;
  error?: string;
  authUrl?: string;
}

const MIN_RESTART_DELAY_MS = 1_000;
const MAX_RESTART_DELAY_MS = 60_000;
const SYNC_STEP_TIMEOUT_MS = 20_000;

class TimeoutError extends Error {}

/**
 * Rejects with a `TimeoutError` if `promise` doesn't settle in time. The work
 * itself keeps running; this only stops a hung Headscale or agent from
 * blocking every sync after it.
 */
function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), SYNC_STEP_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function hasExistingState(workDir: string): Promise<boolean> {
  const path = join(workDir, "tailscaled.state");
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return false;
  }

  try {
    JSON.parse(raw);
    return true;
  } catch {
    // A truncated or corrupt state can never connect, so set it aside and
    // register a fresh identity instead of crash looping on it.
    const aside = `${path}.corrupt-${Date.now()}`;
    await rename(path, aside);
    log.warn("agent", "Agent state is corrupt, moved it to %s", aside);
    return false;
  }
}

declare global {
  // Work dirs owned by a live manager, each mapped to a promise that settles
  // once its owner has stopped the agent. Kept on globalThis so it survives
  // this module being reloaded in development.
  var __headplaneAgentWorkDirs: Map<string, Promise<void>> | undefined;
}

export async function createAgentManager(
  agentConfig: NonNullable<NonNullable<HeadplaneConfig["integration"]>["agent"]> | undefined,
  headscaleUrl: string,
  apiClient: HeadscaleClient,
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
    const created = await mkdir(agentConfig.work_dir, { recursive: true });
    if (created) {
      log.info("agent", "Created agent work dir at %s", agentConfig.work_dir);
    }

    // mkdir succeeds on an existing read-only directory, so check it too.
    await access(agentConfig.work_dir, constants.R_OK | constants.W_OK);
  } catch (error) {
    log.error(
      "agent",
      "Agent work dir at %s isn't usable: %s",
      agentConfig.work_dir,
      error instanceof Error ? error.message : String(error),
    );
    return;
  }

  const hostName = agentConfig.host_name ?? "headplane-agent";
  const cacheTtl = agentConfig.cache_ttl ?? 180_000;
  const executablePath = agentConfig.executable_path;
  const workDir = agentConfig.work_dir;
  const tailscaleNetNS = agentConfig.tailscale_netns;

  // Two agents on one work dir would share the tsnet state. A dev reload
  // creates the new manager before disposing the old one, so a newcomer
  // waits for the previous owner to stop and then takes over.
  const owners = (globalThis.__headplaneAgentWorkDirs ??= new Map());
  const ownerKey = resolve(workDir);
  const previousOwner = owners.get(ownerKey);
  let releaseWorkDir!: () => void;
  const released = new Promise<void>((done) => {
    releaseWorkDir = done;
  });

  const ownership = (previousOwner ?? Promise.resolve()).then(() => released);
  owners.set(ownerKey, ownership);

  let ownsWorkDir = false;
  const ready = (previousOwner ?? Promise.resolve()).then(() => {
    ownsWorkDir = true;
  });

  if (previousOwner) {
    log.info("agent", "Waiting for the previous agent manager to release %s", workDir);
  }

  const state: SyncState = {
    syncedAt: null,
    nodeCount: 0,
    syncedKeys: [],
  };

  let proc: ChildProcess | null = null;
  let responseHandler: ((line: string) => void) | null = null;
  let disposed = false;
  let consecutiveErrors = 0;
  let approvingAuthId: string | undefined;
  let needsAuthKey = false;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let restartDelayMs = MIN_RESTART_DELAY_MS;
  const stopping = new WeakSet<ChildProcess>();

  async function generateAuthKey(): Promise<string> {
    const expiration = new Date(Date.now() + 5 * 60_000);
    const pak = await withTimeout(
      apiClient.preAuthKeys.create({
        user: null,
        ephemeral: false,
        reusable: false,
        expiration,
        aclTags: [`tag:${hostName}`],
      }),
      "Headscale didn't create an auth key in time",
    );
    return pak.key;
  }

  function spawnAgent(authKey: string): ChildProcess {
    const env: Record<string, string> = {
      HOME: process.env.HOME ?? "",
      HEADPLANE_AGENT_WORK_DIR: workDir,
      HEADPLANE_AGENT_TS_SERVER: headscaleUrl,
      HEADPLANE_AGENT_HOSTNAME: hostName,
      HEADPLANE_AGENT_DEBUG: log.debugEnabled ? "true" : "false",
      HEADPLANE_AGENT_TS_NETNS: tailscaleNetNS ? "true" : "false",
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

    // Writing to an agent that just died raises EPIPE here, and an unhandled
    // stream error would take down Headplane. The exit handler cleans up.
    child.stdin?.on("error", (error) => {
      log.debug("agent", "Agent stdin closed: %s", error.message);
    });

    // A failed spawn (e.g. the binary was replaced mid-upgrade) emits "error"
    // and may never emit "exit", so treat it as an exit or the manager would
    // wait on a process that never started.
    child.on("error", (error) => {
      log.error("agent", "Failed to run the agent: %s", error.message);
      if (proc !== child) {
        return;
      }

      proc = null;
      state.startedAt = undefined;
      if (responseHandler) {
        const handler = responseHandler;
        responseHandler = null;
        handler("");
      }

      if (!disposed) {
        scheduleRestart();
      }
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
      if (proc === child) {
        proc = null;
      }

      state.startedAt = undefined;

      // Reject any pending sync request
      if (responseHandler) {
        const handler = responseHandler;
        responseHandler = null;
        handler("");
      }

      if (!disposed && !stopping.has(child)) {
        scheduleRestart();
      }
    });

    proc = child;
    state.startedAt = new Date();
    return child;
  }

  // An agent that dies on its own (crash, OOM, killed) is brought back with
  // backoff, so a binary that crashes on every start can't spin.
  function scheduleRestart() {
    if (restartTimer) {
      return;
    }

    log.info("agent", "Restarting the agent in %ds", restartDelayMs / 1000);
    restartTimer = setTimeout(() => {
      restartTimer = undefined;
      syncInBackground();
    }, restartDelayMs);

    restartDelayMs = Math.min(restartDelayMs * 2, MAX_RESTART_DELAY_MS);
  }

  // Waits for the process to exit so a replacement (or a new manager after a
  // dev reload) never shares the tsnet work dir with a dying one.
  async function stopProcess(child: ChildProcess) {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    stopping.add(child);
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 10_000);
    await exited;
    clearTimeout(timeout);
  }

  // Re-registering leaves the agent's previous node behind in Headscale. Only
  // a node this agent recorded as its own is ever deleted, never one matched
  // by name or tag, so other Headplane instances' agents are left alone.
  async function replacePreviousNode(currentId: string, nodes: Machine[]) {
    const recordPath = join(workDir, "headplane-node-id");
    const previousId = await readFile(recordPath, "utf8").then(
      (id) => id.trim(),
      () => undefined,
    );

    if (previousId === currentId) {
      return;
    }

    if (previousId && nodes.some((node) => node.id === previousId)) {
      try {
        await withTimeout(
          apiClient.nodes.delete(previousId),
          "Headscale didn't delete the previous node in time",
        );
        log.info("agent", "Removed the agent's previous node %s", previousId);

        // Headscale suffixed the new node's name while the old one held it.
        await withTimeout(
          apiClient.nodes.rename(currentId, hostName),
          "Headscale didn't rename the agent's node in time",
        );
      } catch (error) {
        // Keep the record so the next sync retries the delete.
        log.warn(
          "agent",
          "Failed to remove the agent's previous node %s: %s",
          previousId,
          headscaleErrorMessage(error) ?? String(error),
        );
        return;
      }
    }

    await writeFile(recordPath, currentId);
  }

  // A start that outlives a sync's timeout is shared with the next sync
  // instead of racing it, so a slow Headscale can't lead to two agents.
  let starting: Promise<ChildProcess> | undefined;
  function ensureProcess(): Promise<ChildProcess> {
    if (proc && proc.exitCode === null) {
      return Promise.resolve(proc);
    }

    starting ??= startProcess().finally(() => {
      starting = undefined;
    });
    return starting;
  }

  async function startProcess(): Promise<ChildProcess> {
    // A sync still in flight during dispose must not start a fresh agent.
    if (disposed) {
      throw new Error("The agent manager has been shut down");
    }

    if (!ownsWorkDir) {
      throw new Error("Another agent manager is still using the work dir");
    }

    // Passing a key alongside existing state makes some Headscale versions
    // register a duplicate node, and leaves an unused key behind on others.
    const stateExists = await hasExistingState(workDir);
    if (stateExists && !needsAuthKey) {
      log.info("agent", "Existing state found, reusing the agent's identity");
      return spawnAgent("");
    }

    log.info("agent", "Registering the agent with a pre-auth key");
    const authKey = await generateAuthKey();
    if (disposed) {
      throw new Error("The agent manager has been shut down");
    }

    needsAuthKey = false;
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
      const child = await withTimeout(ensureProcess(), "The agent didn't start in time");

      let output: AgentOutput;
      try {
        output = await withTimeout(requestSync(child), "The agent didn't answer in time");
      } catch (error) {
        // A hung agent never answers again, so replace it right away. An agent
        // that exited is restarted with backoff by its exit handler instead.
        if (error instanceof TimeoutError && proc === child) {
          responseHandler = null;
          pendingResync = true;
          await stopProcess(child);
        }

        throw error;
      }

      if (output.error) {
        consecutiveErrors++;
        state.error = output.error;
        log.error("agent", "Sync error from agent (%d/5): %s", consecutiveErrors, output.error);

        if (consecutiveErrors >= 5) {
          log.warn("agent", "Too many consecutive errors, killing agent process for retry");
          await stopProcess(child);
        }
        return;
      }

      // tsnet keeps reporting a stale identity (e.g. its node was deleted)
      // as connected, so Headscale is the only reliable source of truth.
      const nodes = await withTimeout(
        apiClient.nodes.list(),
        "Headscale didn't list nodes in time",
      );
      const self = nodes.find((node) => node.nodeKey === output.self);
      if (!self) {
        log.warn("agent", "Headscale doesn't know the agent's node, re-registering it");
        needsAuthKey = true;
        pendingResync = true;
        await stopProcess(child);
        return;
      }

      await replacePreviousNode(self.id, nodes);

      consecutiveErrors = 0;
      restartDelayMs = MIN_RESTART_DELAY_MS;
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
      state.syncedKeys = keys;
      state.selfKey = output.self || undefined;
      state.error = undefined;

      log.info("agent", "Sync complete: %d nodes updated", keys.length);
    } catch (error) {
      consecutiveErrors++;
      // Headscale API failures are thrown as plain objects, not Errors.
      const message =
        headscaleErrorMessage(error) ?? (error instanceof Error ? error.message : String(error));
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
        syncInBackground();
      }
    }
  }

  /**
   * Prunes any offline nodes marked as ephemeral. This is due to a Headscale
   * bug where ephemeral nodes wouldn't be automatically removed on disconnect.
   */
  async function pruneStaleHostInfo() {
    try {
      const nodes = await withTimeout(
        apiClient.nodes.list(),
        "Headscale didn't list nodes in time",
      );
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
      const nodes = await withTimeout(
        apiClient.nodes.list(),
        "Headscale didn't list nodes in time",
      );
      const toPrune = nodes.filter((n) => n.preAuthKey?.ephemeral && !n.online);

      for (const node of toPrune) {
        await withTimeout(
          apiClient.nodes.delete(node.id),
          "Headscale didn't delete a node in time",
        );
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

  // Background syncs have no caller to catch for them, and an unhandled
  // rejection takes the whole server down.
  function syncInBackground() {
    sync().catch((error) => {
      log.error(
        "agent",
        "Sync crashed: %s",
        error instanceof Error ? error.message : String(error),
      );
    });
  }

  void ready.then(() => {
    if (!disposed) {
      syncInBackground();
    }
  });

  const interval = setInterval(syncInBackground, cacheTtl);

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
        syncedKeys: state.syncedKeys,
        intervalMs: cacheTtl,
        consecutiveErrors,
        startedAt: state.startedAt,
        error: state.error,
        authUrl: state.authUrl,
      };
    },

    async lastUpdated(nodeKeys) {
      if (nodeKeys.length === 0) {
        return {};
      }

      const results = await db
        .select({ id: hostInfo.host_id, updatedAt: hostInfo.updated_at })
        .from(hostInfo)
        .where(inArray(hostInfo.host_id, nodeKeys));

      return Object.fromEntries(
        results.flatMap((r) => (r.updatedAt ? [[r.id, r.updatedAt]] : [])),
      ) as Record<string, Date>;
    },

    agentNodeKey() {
      return state.selfKey;
    },

    async triggerSync() {
      await sync();
    },

    async dispose() {
      disposed = true;
      clearInterval(interval);
      clearTimeout(restartTimer);
      if (proc) {
        await stopProcess(proc);
      }

      releaseWorkDir();
      if (owners.get(ownerKey) === ownership) {
        owners.delete(ownerKey);
      }
    },
  };
}
