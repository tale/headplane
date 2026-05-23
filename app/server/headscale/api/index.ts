// MARK: Headscale API
//
// The public entry point for talking to a Headscale server. Boot
// detects the server version via `GET /version` (unauthenticated,
// available since Headscale 0.26.0), derives a typed `Capabilities`
// object, and returns a `Headscale` value that constructs
// authenticated `HeadscaleClient`s on demand.

import log from "~/utils/log";

import { type Capabilities, capabilitiesFor } from "./capabilities";
import { type ApiKeyApi, makeApiKeyApi } from "./resources/api-keys";
import { makeNodeApi, type NodeApi } from "./resources/nodes";
import { makePolicyApi, type PolicyApi } from "./resources/policy";
import { makePreAuthKeyApi, type PreAuthKeyApi } from "./resources/pre-auth-keys";
import { makeUserApi, type UserApi } from "./resources/users";
import { formatServerVersion, parseServerVersion, type ServerVersion } from "./server-version";
import { createTransport, type Transport } from "./transport";

export interface Headscale {
  readonly version: ServerVersion;
  readonly capabilities: Capabilities;
  /** True if the Headscale server's `/health` endpoint returns 200. */
  health(): Promise<boolean>;
  /** Build an API client bound to a specific Headscale API key. */
  client(apiKey: string): HeadscaleClient;
  /** Stop background work and close the underlying HTTP agent. */
  dispose(): Promise<void>;
}

export interface HeadscaleClient {
  nodes: NodeApi;
  users: UserApi;
  policy: PolicyApi;
  preAuthKeys: PreAuthKeyApi;
  apiKeys: ApiKeyApi;
  /**
   * Convenience passthrough to `Headscale.health()`. Headscale's
   * `/health` endpoint is unauthenticated so callers that already
   * have a client (loaders/actions) don't need to also reach for
   * the top-level `Headscale` value.
   */
  isHealthy(): Promise<boolean>;
}

export interface CreateHeadscaleOptions {
  url: string;
  certPath?: string;
}

export async function createHeadscale(opts: CreateHeadscaleOptions): Promise<Headscale> {
  const transport = await createTransport({ url: opts.url, certPath: opts.certPath });

  const versionInfo = await transport.getPublic<{ version: string }>("/version");
  const version = parseServerVersion(versionInfo.version);
  const capabilities = capabilitiesFor(version);

  if (version.unknown) {
    log.warn(
      "api",
      "Could not parse Headscale version %s, assuming newest known capabilities",
      versionInfo.version,
    );
  } else {
    log.info("api", "Connected to Headscale %s", formatServerVersion(version));
  }

  return makeHeadscale(transport, version, capabilities);
}

function makeHeadscale(
  transport: Transport,
  version: ServerVersion,
  capabilities: Capabilities,
): Headscale {
  return {
    version,
    capabilities,
    health: () => transport.health(),
    client(apiKey) {
      return {
        nodes: makeNodeApi(transport, capabilities, apiKey),
        users: makeUserApi(transport, capabilities, apiKey),
        policy: makePolicyApi(transport, capabilities, apiKey),
        preAuthKeys: makePreAuthKeyApi(transport, capabilities, apiKey),
        apiKeys: makeApiKeyApi(transport, capabilities, apiKey),
        isHealthy: () => transport.health(),
      };
    },
    dispose: () => transport.dispose(),
  };
}
