import { exit } from "node:process";

import { serve } from "@hono/node-server";

import log from "~/utils/log";

import { ConfigError } from "./config/error";
import { loadConfig } from "./config/load";
import { createAppContext } from "./context";
import { createHeadplaneHonoApp } from "./hono-app";

const PREFIX = process.env.__INTERNAL_PREFIX || "/admin";
(globalThis as Record<string, unknown>).__PREFIX__ = PREFIX;
(globalThis as Record<string, unknown>).__VERSION__ = process.env.HEADPLANE_VERSION ?? "dev";

let config;
try {
  config = await loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    log.error("server", "Unable to load configuration: %s", error.message);
  } else {
    log.error("server", "Failed to load configuration: %s", error);
  }
  exit(1);
}

const context = await createAppContext(config);
context.auth.start();

const app = createHeadplaneHonoApp({
  context,
  prefix: PREFIX,
  staticRoot: "build/client",
});

serve(
  {
    fetch: app.fetch,
    hostname: config.server.host,
    port: config.server.port,
  },
  (info) => {
    log.info("server", "Listening on http://%s:%s", info.address, info.port);
  },
);
