import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { kill } from "node:process";
import { setTimeout } from "node:timers/promises";

import type { RuntimeApiClient } from "~/server/headscale/api/endpoints";

import log from "~/utils/log";

/**
 * Does a two-stage scan of /proc to find the headscale process that is running
 * a "serve" subcommand. It first scans all processes' comm files to find
 * headscale processes, then checks their cmdline files to see if "serve" is
 * the second argument.
 *
 * @param procPath The path to the proc filesystem (default: /proc)
 * @returns The PID of the headscale serve process, or undefined if not found
 */
export async function findHeadscaleServe(procPath = "/proc"): Promise<number | undefined> {
  const subdirs = await readdir(procPath);
  const commResults = await Promise.allSettled(
    subdirs.map(async (entry) => {
      const pid = Number.parseInt(entry, 10);
      if (Number.isNaN(pid)) {
        return undefined;
      }

      try {
        const comm = await readFile(join(procPath, entry, "comm"), "utf8");
        return comm.trim() === "headscale" ? pid : undefined;
      } catch {
        return undefined;
      }
    }),
  );

  const headscalePids = commResults
    .map((result) => {
      if (result.status === "fulfilled" && result.value !== undefined) {
        return result.value;
      }
      return undefined;
    })
    .filter((pid): pid is number => pid !== undefined);

  if (headscalePids.length === 0) {
    return undefined;
  }

  log.debug("config", "Found %d headscale process(es), checking for serve", headscalePids.length);
  for (const pid of headscalePids) {
    try {
      const cmdline = await readFile(join(procPath, pid.toString(), "cmdline"), "utf8");
      const args = cmdline.split("\0").filter(Boolean);

      if (args[1] === "serve") {
        return pid;
      }
    } catch {
      // Process may have exited between stages
    }
  }

  return undefined;
}

/**
 * Options for signaling the headscale process.
 */
export interface SignalHeadscaleOptions {
  pid: number;
  signal?: NodeJS.Signals;
  maxAttempts?: number;
  retryDelayMs?: number;
}

/**
 * Sends a signal to the headscale process and waits for it to become healthy.
 * @param client The RuntimeApiClient to check health
 * @param options Options for signaling and waiting
 * @returns True if headscale became healthy, false otherwise
 */
export async function signalAndWaitHealthy(
  client: RuntimeApiClient,
  options: SignalHeadscaleOptions,
): Promise<boolean> {
  const { pid, signal = "SIGHUP", maxAttempts = 10, retryDelayMs = 1000 } = options;

  try {
    kill(pid, signal);
    log.info("config", "Sent %s to Headscale (PID %d)", signal, pid);
  } catch (error) {
    log.error("config", "Failed to send %s to PID %d: %s", signal, pid, error);
    return false;
  }

  await setTimeout(retryDelayMs);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const healthy = await client.isHealthy();
      if (healthy) {
        log.info("config", "Headscale is healthy after restart");
        return true;
      }
    } catch {
      // Still restarting
    }

    if (attempt < maxAttempts) {
      await setTimeout(retryDelayMs);
    }
  }

  log.error("config", "Headscale did not become healthy after %d attempts", maxAttempts);
  return false;
}
