import { join } from "node:path";

import { createContext } from "react-router";

import log from "~/utils/log";

import type { HeadplaneConfig } from "./config/config-schema";
import { loadIntegration } from "./config/integration";
import { createDbClient } from "./db/client.server";
import { disabled, enabled, type Feature } from "./feature";
import { createHeadscale, type HeadscaleClient } from "./headscale/api";
import { loadHeadscaleConfig } from "./headscale/config-loader";
import { createLiveStore, nodesResource, usersResource } from "./headscale/live-store";
import { type AgentManager, createAgentManager } from "./hp-agent";
import { createOidcService, type OidcService } from "./oidc/provider";
import { createAuthService, type Principal } from "./web/auth";

export type AppContext = Awaited<ReturnType<typeof createAppContext>>;
export const agentsContext = createContext<AppContext["agents"]>();
export const appConfigContext = createContext<AppContext["config"]>();
export const authContext = createContext<AppContext["auth"]>();
export const dbContext = createContext<AppContext["db"]>();
export const headscaleContext = createContext<AppContext["headscale"]>();
export const headscaleApiKeyContext = createContext<AppContext["headscaleApiKey"]>();
export const headscaleConfigContext = createContext<AppContext["hs"]>();
export const headscaleLiveStoreContext = createContext<AppContext["hsLive"]>();
export const integrationContext = createContext<AppContext["integration"]>();
export const oidcContext = createContext<AppContext["oidc"]>();
export const requestApiContext = createContext<AppContext["apiForRequest"]>();

export async function createAppContext(config: HeadplaneConfig) {
  const db = await createDbClient(join(config.server.data_path, "hp_persist.db"));
  const headscale = await createHeadscale({
    url: config.headscale.url,
    certPath: config.headscale.tls_cert_path,
  });

  // Resolve the Headscale API key: headscale.api_key takes precedence,
  // falling back to the deprecated oidc.headscale_api_key for compatibility.
  const headscaleApiKey = config.headscale.api_key ?? config.oidc?.headscale_api_key;

  const agents = await buildAgents(
    config,
    headscale.capabilities.preAuthKeysHaveStableIds,
    headscaleApiKey ? headscale.client(headscaleApiKey) : undefined,
    db,
  );

  const auth = createAuthService({
    secret: config.server.cookie_secret,
    headscaleApiKey,
    proxyAuth: config.server.proxy_auth
      ? {
          enabled: config.server.proxy_auth.enabled,
          allowedCidrs: config.server.proxy_auth.allowed_cidrs,
          trustedProxyCidrs: config.server.proxy_auth.trusted_proxy_cidrs,
          ipHeader: config.server.proxy_auth.ip_header,
          userHeader: config.server.proxy_auth.user_header,
          emailHeader: config.server.proxy_auth.email_header,
          nameHeader: config.server.proxy_auth.name_header,
          pictureHeader: config.server.proxy_auth.picture_header,
        }
      : undefined,
    db,
    cookie: {
      name: "_hp_auth",
      secure: config.server.cookie_secure,
      maxAge: config.server.cookie_max_age,
      domain: config.server.cookie_domain,
    },
  });

  const oidc = buildOidc(config, headscaleApiKey);

  const hsLive = createLiveStore([nodesResource, usersResource]);
  const hs = await loadHeadscaleConfig(
    config.headscale.config_path,
    config.headscale.dns_records_path,
  );
  const integration = await loadIntegration(config.integration);

  // Disposers run in reverse-registration order on shutdown.
  const disposers: Array<() => Promise<void> | void> = [
    () => auth.stop(),
    () => hsLive.dispose(),
    () => headscale.dispose(),
  ];
  if (agents.state === "enabled") {
    disposers.push(() => agents.value.dispose());
  }

  async function apiForRequest(
    request: Request,
  ): Promise<{ principal: Principal; api: HeadscaleClient }> {
    const principal = await auth.require(request);
    const apiKey = auth.getHeadscaleApiKey(principal);
    return { principal, api: headscale.client(apiKey) };
  }

  function startServices() {
    auth.start();
  }

  async function dispose() {
    for (const d of [...disposers].reverse()) {
      try {
        await d();
      } catch (error) {
        log.warn("server", "Error during shutdown: %s", String(error));
      }
    }
  }

  return {
    config,
    db,
    headscale,
    headscaleApiKey,
    agents,
    auth,
    oidc,
    hsLive,
    hs,
    integration,
    apiForRequest,
    startServices,
    dispose,
  };
}

function buildOidc(
  config: HeadplaneConfig,
  headscaleApiKey: string | undefined,
): Feature<OidcService> {
  if (!config.oidc) {
    return disabled("OIDC is not configured");
  }
  if (config.oidc.enabled === false) {
    return disabled("OIDC is disabled in the configuration");
  }
  if (!headscaleApiKey) {
    return disabled("OIDC requires headscale.api_key to be configured");
  }

  return enabled(
    createOidcService({
      issuer: config.oidc.issuer,
      clientId: config.oidc.client_id,
      clientSecret: config.oidc.client_secret,
      baseUrl: config.server.base_url ?? "",
      authorizationEndpoint: config.oidc.authorization_endpoint,
      tokenEndpoint: config.oidc.token_endpoint,
      userinfoEndpoint: config.oidc.userinfo_endpoint,
      endSessionEndpoint: config.oidc.end_session_endpoint,
      tokenEndpointAuthMethod:
        config.oidc.token_endpoint_auth_method === "client_secret_jwt"
          ? undefined
          : config.oidc.token_endpoint_auth_method,
      usePkce: config.oidc.use_pkce,
      scope: config.oidc.scope,
      subjectClaims: config.oidc.subject_claims,
      roleClaim: config.oidc.role_claim,
      allowWeakRsaKeys: config.oidc.allow_weak_rsa_keys,
      extraParams: config.oidc.extra_params,
      profilePictureSource: config.oidc.profile_picture_source,
      postLogoutRedirectUri: config.oidc.post_logout_redirect_uri,
    }),
  );
}

async function buildAgents(
  config: HeadplaneConfig,
  supportsTagOnlyKeys: boolean,
  apiClient: HeadscaleClient | undefined,
  db: Awaited<ReturnType<typeof createDbClient>>,
): Promise<Feature<AgentManager>> {
  const agentConfig = config.integration?.agent;
  if (!agentConfig?.enabled) {
    return disabled("Agent is not enabled in the configuration");
  }
  if (!apiClient) {
    return disabled("Agent requires headscale.api_key to be configured");
  }
  if (!supportsTagOnlyKeys) {
    return disabled("Agent requires Headscale 0.28 or newer");
  }

  const manager = await createAgentManager(
    agentConfig,
    config.headscale.url,
    apiClient,
    supportsTagOnlyKeys,
    db,
  );
  if (!manager) {
    return disabled("Agent failed to initialize (see logs)");
  }
  return enabled(manager);
}
