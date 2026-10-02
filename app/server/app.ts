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

import type { RequestListener } from "node:http";
import { exit, versions } from "node:process";

import { createRequestListener } from "@react-router/node";
import { RouterContextProvider } from "react-router";
import * as build from "virtual:react-router/server-build";

import log from "~/utils/log";
import { setServerPrefix } from "~/utils/prefix";

import { configureBuild } from "./assets";
import type { HeadplaneConfig } from "./config/config-schema";
import { ConfigError } from "./config/error";
import { loadConfig } from "./config/load";
import {
  agentsContext,
  appConfigContext,
  authContext,
  createAppContext,
  dbContext,
  headscaleApiKeyContext,
  headscaleConfigContext,
  headscaleContext,
  headscaleLiveStoreContext,
  integrationContext,
  oidcContext,
  requestApiContext,
} from "./context";

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

if ((config.server.tls_cert_path || config.server.tls_key_path) && !config.server.cookie_secure) {
  log.warn(
    "server",
    "TLS is enabled but `server.cookie_secure` is false; forcing it to true (browsers reject Secure-less cookies over HTTPS)",
  );
  config.server.cookie_secure = true;
}

setServerPrefix(config.server.base_path);
const ctx = await createAppContext(config);
ctx.startServices();

export { config };

/**
 * Disposes the per-process context. Invoked by the production
 * supervisor on SIGTERM/SIGINT and by the dev Vite plugin on HMR
 * reload.
 */
export async function dispose(): Promise<void> {
  await ctx.dispose();
}

// TODO: `getLoadContext` is the right place to handle reverse proxy
// translation — better than doing it in the OIDC client because it
// applies to all requests, not just OIDC ones.
function getLoadContext(request: Request, client: ClientAddress) {
  ctx.auth.registerRequestClientAddress(request, client.address);

  const routerContext = new RouterContextProvider();
  routerContext.set(agentsContext, ctx.agents);
  routerContext.set(appConfigContext, ctx.config);
  routerContext.set(authContext, ctx.auth);
  routerContext.set(dbContext, ctx.db);
  routerContext.set(headscaleContext, ctx.headscale);
  routerContext.set(headscaleApiKeyContext, ctx.headscaleApiKey);
  routerContext.set(headscaleConfigContext, ctx.hs);
  routerContext.set(headscaleLiveStoreContext, ctx.hsLive);
  routerContext.set(integrationContext, ctx.integration);
  routerContext.set(oidcContext, ctx.oidc);
  routerContext.set(requestApiContext, ctx.apiForRequest);
  return routerContext;
}

interface ClientAddress {
  address?: string;
}

export const runtimeBuild = import.meta.env.PROD
  ? configureBuild(build, config.server.base_path)
  : { ...build, basename: config.server.base_path };
const requestListener = createRequestListener({
  build: runtimeBuild,
  mode: import.meta.env.MODE,
  getLoadContext,
});

// The emitted manifest contains build-time URLs; serve its runtime equivalent.
// This also supports clients that load the full manifest after hydration.
const listener: RequestListener = (request, response) => {
  if (
    import.meta.env.PROD &&
    request.url &&
    new URL(request.url, "http://localhost").pathname === runtimeBuild.assets.url &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache");
    response.end(
      request.method === "HEAD"
        ? undefined
        : `window.__reactRouterManifest=${JSON.stringify(runtimeBuild.assets)};`,
    );
    return;
  }
  requestListener(request, response);
};
export default listener;
