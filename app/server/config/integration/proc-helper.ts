import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { kill } from "node:process";
import { setTimeout } from "node:timers/promises";

import type { Headscale } from "~/server/headscale/api";
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
 * Triggers a full restart of the headscale process and waits for it to
 * come back again healthy. Returns true if successful, false otherwise.
 */
export async function restartAndWaitHealthy(headscale: Headscale, pid: number): Promise<boolean> {
  try {
    kill(pid, "SIGTERM");
    log.info("config", "Sent SIGTERM to Headscale (PID %d)", pid);
  } catch (error) {
    log.error("config", "Failed to send SIGTERM to PID %d: %s", pid, error);
    return false;
  }

  for (let attempt = 0; attempt < 60; attempt++) {
    await setTimeout(1000);
    const current = await findHeadscaleServe();
    if (current && current !== pid && (await headscale.health().catch(() => false))) {
      log.info("config", "Headscale is healthy after restart (PID %d)", current);
      return true;
    }
  }

  log.error("config", "Headscale did not come back after SIGTERM, is it supervised?");
  return false;
}
