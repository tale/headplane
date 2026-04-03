import { join } from "node:path";
import { exit, versions } from "node:process";

import { createHonoServer } from "react-router-hono-server/node";

import log from "~/utils/log";

import { loadIntegration } from "./config/integration";
import { loadConfig } from "./config/load";
import { createDbClient } from "./db/client.server";
import { createHeadscaleInterface } from "./headscale/api";
import { loadHeadscaleConfig } from "./headscale/config-loader";
import { createLiveStore, nodesResource, usersResource } from "./headscale/live-store";
import { createAgentManager } from "./hp-agent";
import { createAuthService } from "./web/auth";

declare global {
  const __PREFIX__: string;
  const __VERSION__: string;
}

// MARK: Side-Effects
// This module contains a side-effect because everything running here
// exists for the lifetime of the process, making it appropriate.
log.info("server", "Running Node.js %s", versions.node);
let config: HeadplaneConfig;

try {
  config = await loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    log.error("server", "Unable to load configuration: %s", error.message);
  }

  exit(1);
}

const db = await createDbClient(join(config.server.data_path, "hp_persist.db"));
const hsApi = await createHeadscaleInterface(config.headscale.url, config.headscale.tls_cert_path);

// Resolve the Headscale API key: headscale.api_key takes precedence,
// falling back to the deprecated oidc.headscale_api_key for compatibility.
const headscaleApiKey = config.headscale.api_key ?? config.oidc?.headscale_api_key;

const agents = headscaleApiKey
  ? await createAgentManager(
      config.integration?.agent,
      config.headscale.url,
      hsApi.getRuntimeClient(headscaleApiKey),
      hsApi.clientHelpers.isAtleast("0.28.0"),
      db,
    )
  : (() => {
      if (config.integration?.agent?.enabled) {
        log.warn("agent", "Agent is enabled but no headscale.api_key is configured");
      }
      return undefined;
    })();

// We also use this file to load anything needed by the react router code.
// These are usually per-request things that we need access to, like the
// helper that can issue and revoke cookies.
export type LoadContext = typeof appLoadContext;

import "react-router";
import { HeadplaneConfig } from "./config/config-schema";
import { ConfigError } from "./config/error";
import { createOidcService } from "./oidc/provider";

declare module "react-router" {
  interface AppLoadContext extends LoadContext {}
}

const hsLive = createLiveStore([nodesResource, usersResource]);

const appLoadContext = {
  config,
  hsLive,
  hs: await loadHeadscaleConfig(
    config.headscale.config_path,
    config.headscale.config_strict,
    config.headscale.dns_records_path,
  ),

  auth: createAuthService({
    secret: config.server.cookie_secret,
    headscaleApiKey,
    db,
    cookie: {
      name: "_hp_auth",
      secure: config.server.cookie_secure,
      maxAge: config.server.cookie_max_age,
      domain: config.server.cookie_domain,
    },
  }),

  headscaleApiKey,
  hsApi,
  agents,
  integration: await loadIntegration(config.integration),
  oidc:
    config.oidc && config.oidc.enabled !== false && headscaleApiKey
      ? {
          service: createOidcService({
            issuer: config.oidc.issuer,
            clientId: config.oidc.client_id,
            clientSecret: config.oidc.client_secret,
            baseUrl: config.server.base_url ?? "",
            authorizationEndpoint: config.oidc.authorization_endpoint,
            tokenEndpoint: config.oidc.token_endpoint,
            userinfoEndpoint: config.oidc.userinfo_endpoint,
            tokenEndpointAuthMethod:
              config.oidc.token_endpoint_auth_method === "client_secret_jwt"
                ? undefined
                : config.oidc.token_endpoint_auth_method,
            usePkce: config.oidc.use_pkce,
            scope: config.oidc.scope,
            extraParams: config.oidc.extra_params,
            profilePictureSource: config.oidc.profile_picture_source,
          }),
          disableApiKeyLogin: config.oidc.disable_api_key_login,
        }
      : undefined,
  db,
};

declare module "react-router" {
  interface AppLoadContext extends LoadContext {}
}

export default createHonoServer({
  overrideGlobalObjects: true,
  port: config.server.port,
  hostname: config.server.host,
  beforeAll: async (app) => {
    app.use(__PREFIX__, async (c) => {
      return c.redirect(`${__PREFIX__}/`);
    });
  },
  serveStaticOptions: {
    publicAssets: {
      // This is part of our monkey-patch for react-router-hono-server
      // To see the first part, go to the patches/ directory.
      rewriteRequestPath: (path) => path.replace(`${__PREFIX__}`, ""),
    },
    clientAssets: {
      // This is part of our monkey-patch for react-router-hono-server
      // To see the first part, go to the patches/ directory.
      rewriteRequestPath: (path) => path.replace(`${__PREFIX__}`, ""),
    },
  },

  // Only log in development mode
  defaultLogger: import.meta.env.DEV,
  getLoadContext() {
    // TODO: This is the place where we can handle reverse proxy translation
    // This is better than doing it in the OIDC client, since we can do it
    // for all requests, not just OIDC ones.
    return appLoadContext;
  },

  listeningListener(info) {
    log.info("server", "Running on %s:%s", info.address, info.port);
  },
});

// Prune expired auth sessions every 15 minutes
setInterval(
  () => {
    appLoadContext.auth.pruneExpiredSessions();
  },
  15 * 60 * 1000,
);

process.on("SIGINT", () => {
  log.info("server", "Received SIGINT, shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  log.info("server", "Received SIGTERM, shutting down...");
  process.exit(0);
});
