import { platform } from "node:os";

import { type } from "arktype";

import type { Headscale } from "~/server/headscale/api";
import log from "~/utils/log";

import { Integration } from "./abstract";
import { findHeadscaleServe, restartAndWaitHealthy } from "./proc-helper";

const configSchema = {
  full: type({
    enabled: "boolean",
  }),

  partial: type({
    enabled: "boolean?",
  }).partial(),
};

export default class ProcIntegration extends Integration<typeof configSchema.full.infer> {
  get name() {
    return "Native Linux (/proc)";
  }

  static get configSchema() {
    return configSchema;
  }

  async isAvailable() {
    if (platform() !== "linux") {
      log.error("config", "/proc is only available on Linux");
      return false;
    }

    try {
      const result = await findHeadscaleServe();
      if (!result) {
        log.error("config", "Could not find headscale serve process");
        return false;
      }

      log.info("config", "Found headscale serve (PID %d)", result);
      return true;
    } catch (error) {
      log.error("config", "Failed to scan /proc: %s", error);
      return false;
    }
  }

  async onConfigChange(headscale: Headscale) {
    const pid = await findHeadscaleServe();
    if (!pid) {
      log.error("config", "Could not find headscale serve process");
      return false;
    }

    return restartAndWaitHealthy(headscale, pid);
  }
}
