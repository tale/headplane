import { join } from "node:path";

import log from "~/utils/log";

import type { HeadplaneConfig } from "./config/config-schema";
import { loadIntegration } from "./config/integration";
import { createDbClient } from "./db/client.server";
import { createHeadscaleInterface } from "./headscale/api";
import { loadHeadscaleConfig } from "./headscale/config-loader";
import { createLiveStore, nodesResource, usersResource } from "./headscale/live-store";
import { createAgentManager } from "./hp-agent";
import { createOidcService } from "./oidc/provider";
import { createAuthService } from "./web/auth";

export type AppContext = Awaited<ReturnType<typeof createAppContext>>;

declare module "react-router" {
  interface AppLoadContext extends AppContext {}
}

export async function createAppContext(config: HeadplaneConfig) {
  const db = await createDbClient(join(config.server.data_path, "hp_persist.db"));
  const hsApi = await createHeadscaleInterface(
    config.headscale.url,
    config.headscale.tls_cert_path,
  );

  // Resolve the Headscale API key: headscale.api_key takes precedence,
  // falling back to the deprecated oidc.headscale_api_key for compatibility.
  const headscaleApiKey = config.headscale.api_key ?? config.oidc?.headscale_api_key;

  let agents;
  if (headscaleApiKey) {
    agents = await createAgentManager(
      config.integration?.agent,
      config.headscale.url,
      hsApi.getRuntimeClient(headscaleApiKey),
      hsApi.clientHelpers.isAtleast("0.28.0"),
      db,
    );
  } else if (config.integration?.agent?.enabled) {
    log.warn("agent", "Agent is enabled but no headscale.api_key is configured");
  }

  const auth = createAuthService({
    secret: config.server.cookie_secret,
    headscaleApiKey,
    db,
    cookie: {
      name: "_hp_auth",
      secure: config.server.cookie_secure,
      maxAge: config.server.cookie_max_age,
      domain: config.server.cookie_domain,
    },
  });

  const oidc =
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
            endSessionEndpoint: config.oidc.end_session_endpoint,
            tokenEndpointAuthMethod:
              config.oidc.token_endpoint_auth_method === "client_secret_jwt"
                ? undefined
                : config.oidc.token_endpoint_auth_method,
            usePkce: config.oidc.use_pkce,
            scope: config.oidc.scope,
            subjectClaims: config.oidc.subject_claims,
            allowWeakRsaKeys: config.oidc.allow_weak_rsa_keys,
            extraParams: config.oidc.extra_params,
            profilePictureSource: config.oidc.profile_picture_source,
            postLogoutRedirectUri: config.oidc.post_logout_redirect_uri,
          }),
          disableApiKeyLogin: config.oidc.disable_api_key_login,
          useEndSession: config.oidc.use_end_session,
        }
      : undefined;

  return {
    config,
    db,
    hsApi,
    headscaleApiKey,
    agents,
    auth,
    oidc,
    hsLive: createLiveStore([nodesResource, usersResource]),
    hs: await loadHeadscaleConfig(
      config.headscale.config_path,
      config.headscale.config_strict,
      config.headscale.dns_records_path,
    ),
    integration: await loadIntegration(config.integration),
  };
}
