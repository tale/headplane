import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { access, constants, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

import { inArray, notInArray, sql } from "drizzle-orm";
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
const REGISTER_GRACE_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), SYNC_STEP_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

declare global {
  // On globalThis so it survives module reloads in development.
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

    // mkdir succeeds on an existing read-only directory.
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

  // Dev reloads create the next manager before disposing this one.
  const owners = (globalThis.__headplaneAgentWorkDirs ??= new Map());
  const ownerKey = resolve(workDir);
  if (owners.has(ownerKey)) {
    log.info("agent", "Waiting for the previous agent manager to release %s", workDir);
  }

  const previousOwner = owners.get(ownerKey) ?? Promise.resolve();
  let releaseWorkDir!: () => void;
  const released = new Promise<void>((done) => {
    releaseWorkDir = done;
  });
  owners.set(
    ownerKey,
    previousOwner.then(() => released),
  );

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
  let ownsWorkDir = false;
  let isSyncing = false;
  let pendingResync = false;
  const stopping = new WeakSet<ChildProcess>();
  const registering = new WeakSet<ChildProcess>();

  function spawnAgent(authKey?: string): ChildProcess {
    if (disposed) {
      throw new Error("The agent manager has been shut down");
    }

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

    if (authKey) {
      registering.add(child);
    }

    // A dead agent's EPIPE would otherwise crash Headplane.
    child.stdin?.on("error", (error) => {
      log.debug("agent", "Agent stdin closed: %s", error.message);
    });

    child.on("error", (error) => {
      log.error("agent", "Failed to run the agent: %s", error.message);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (!text) {
        return;
      }

      log.debug("agent", "%s", text);

      // tsnet prints an auth URL when it falls back to interactive login.
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
      responseHandler?.(line);
      responseHandler = null;
    });

    // Unlike exit, close also fires when the spawn itself fails.
    child.on("close", (code, signal) => {
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

      if (proc !== child) {
        return;
      }

      proc = null;
      state.startedAt = undefined;
      responseHandler?.("");
      responseHandler = null;

      if (!disposed && !stopping.has(child)) {
        scheduleRestart();
      }
    });

    proc = child;
    state.startedAt = new Date();
    return child;
  }

  function scheduleRestart() {
    if (restartTimer) {
      return;
    }

    log.info("agent", "Restarting the agent in %ds", restartDelayMs / 1000);
    restartTimer = setTimeout(() => {
      restartTimer = undefined;
      void sync();
    }, restartDelayMs);

    restartDelayMs = Math.min(restartDelayMs * 2, MAX_RESTART_DELAY_MS);
  }

  async function stopProcess(child: ChildProcess) {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    stopping.add(child);
    const exited = once(child, "close").catch((error: Error) => {
      log.warn("agent", "Failed to stop the agent: %s", error.message);
    });
    child.kill("SIGTERM");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 10_000);
    await exited;
    clearTimeout(timeout);
  }

  // Only delete a node this agent recorded, others share its name and tag.
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
      } catch (error) {
        log.warn(
          "agent",
          "Failed to remove the agent's previous node %s: %s",
          previousId,
          headscaleErrorMessage(error) ?? String(error),
        );
        return;
      }

      try {
        await withTimeout(
          apiClient.nodes.rename(currentId, hostName),
          "Headscale didn't rename the agent's node in time",
        );
      } catch (error) {
        log.warn(
          "agent",
          "Failed to rename the agent's node to %s: %s",
          hostName,
          headscaleErrorMessage(error) ?? String(error),
        );
      }
    }

    await writeFile(recordPath, currentId);
  }

  async function findSelf(child: ChildProcess, nodeKey: string) {
    const deadline = registering.has(child) ? Date.now() + REGISTER_GRACE_MS : 0;
    while (true) {
      const nodes = await withTimeout(
        apiClient.nodes.list(),
        "Headscale didn't list nodes in time",
      );

      const self = nodes.find((node) => node.nodeKey === nodeKey);
      if (self || Date.now() >= deadline || child.exitCode !== null) {
        registering.delete(child);
        return { nodes, self };
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  async function startProcess(): Promise<ChildProcess> {
    if (disposed) {
      throw new Error("The agent manager has been shut down");
    }

    if (!ownsWorkDir) {
      throw new Error("Another agent manager is still using the work dir");
    }

    const statePath = join(workDir, "tailscaled.state");
    let hasState = false;
    try {
      JSON.parse(await readFile(statePath, "utf8"));
      hasState = true;
    } catch (error) {
      if (error instanceof SyntaxError) {
        const aside = `${statePath}.corrupt-${Date.now()}`;
        await rename(statePath, aside);
        log.warn("agent", "Agent state is corrupt, moved it to %s", aside);
      }
    }

    // A key alongside existing state makes Headscale 0.28 register a duplicate.
    if (hasState && !needsAuthKey) {
      log.info("agent", "Existing state found, reusing the agent's identity");
      return spawnAgent();
    }

    log.info("agent", "Registering the agent with a pre-auth key");
    const authKey = await withTimeout(
      apiClient.preAuthKeys.create({
        user: null,
        ephemeral: false,
        reusable: false,
        expiration: new Date(Date.now() + 5 * 60_000),
        aclTags: [`tag:${hostName}`],
      }),
      "Headscale didn't create an auth key in time",
    );

    needsAuthKey = false;
    return spawnAgent(authKey.key);
  }

  async function sync() {
    if (isSyncing) {
      pendingResync = true;
      log.debug("agent", "Sync already in progress, queued resync");
      return;
    }

    isSyncing = true;
    try {
      const child = proc?.exitCode === null ? proc : await startProcess();

      let line: string;
      try {
        line = await withTimeout(
          new Promise<string>((resolve) => {
            responseHandler = resolve;
            child.stdin?.write("sync\n");
          }),
          "The agent didn't answer in time",
        );
      } catch (error) {
        responseHandler = null;
        pendingResync = true;
        await stopProcess(child);
        throw error;
      }

      if (!line) {
        throw new Error("Agent process closed unexpectedly");
      }

      const output = JSON.parse(line) as AgentOutput;

      if (output.error) {
        consecutiveErrors++;
        state.error = output.error;
        log.error("agent", "Sync error from agent (%d/5): %s", consecutiveErrors, output.error);

        if (consecutiveErrors >= 5) {
          log.warn("agent", "Too many consecutive errors, killing agent process for retry");
          await stopProcess(child);
          scheduleRestart();
        }
        return;
      }

      // tsnet reports a deleted node as connected, so ask Headscale.
      const { nodes, self } = await findSelf(child, output.self);
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

      if (keys.length > 0) {
        const updatedAt = new Date();
        await db
          .insert(hostInfo)
          .values(
            Object.entries(output.hosts).map(([nodeKey, payload]) => ({
              host_id: nodeKey,
              payload,
              updated_at: updatedAt,
            })),
          )
          .onConflictDoUpdate({
            target: hostInfo.host_id,
            set: { payload: sql`excluded.payload`, updated_at: sql`excluded.updated_at` },
          });
      }

      await db.delete(hostInfo).where(
        notInArray(
          hostInfo.host_id,
          nodes.map((node) => node.nodeKey),
        ),
      );

      // Headscale doesn't remove ephemeral nodes when they disconnect.
      for (const node of nodes.filter((n) => n.preAuthKey?.ephemeral && !n.online)) {
        await withTimeout(
          apiClient.nodes.delete(node.id),
          "Headscale didn't delete a node in time",
        ).then(
          () => log.info("agent", "Pruned offline ephemeral node %s", node.givenName),
          (error) =>
            log.warn(
              "agent",
              "Failed to prune ephemeral node %s: %s",
              node.givenName,
              headscaleErrorMessage(error) ?? String(error),
            ),
        );
      }

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
        void sync();
      }
    }
  }

  void previousOwner.then(() => {
    ownsWorkDir = true;
    if (!disposed) {
      void sync();
    }
  });

  const interval = setInterval(() => void sync(), cacheTtl);

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

      // Deleting the entry would let the next manager skip a live owner.
      releaseWorkDir();
    },
  };
}
