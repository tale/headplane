// MARK: Headplane Application
//
// Loads configuration, builds the per-process app context, and exports
// the React Router request listener as the default export.
//
// This module is consumed in two places:
//   - `app/server/main.ts` — the production bootstrap; wraps the
//     listener with static-asset serving and binds an http(s) server.
//   - `runtime/vite-plugin.ts` — the dev-mode Vite middleware; loads
//     this module through `ssrLoadModule` and dispatches each request.

import { exit, versions } from "node:process";

import { createRequestListener } from "@react-router/node";
import * as build from "virtual:react-router/server-build";

import log from "~/utils/log";

import type { HeadplaneConfig } from "./config/config-schema";
import { ConfigError } from "./config/error";
import { loadConfig } from "./config/load";
import { createAppContext } from "./context";

log.info("server", "Running Node.js %s", versions.node);

let config: HeadplaneConfig;
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

const ctx = await createAppContext(config);
ctx.auth.start();

export { config };

// TODO: `getLoadContext` is the right place to handle reverse proxy
// translation — better than doing it in the OIDC client because it
// applies to all requests, not just OIDC ones.
export default createRequestListener({
  build,
  mode: import.meta.env.MODE,
  getLoadContext: () => ctx,
});
