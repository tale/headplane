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
import { createTransport } from "./transport";

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
}

export interface CreateHeadscaleOptions {
  url: string;
  certPath?: string;
  /**
   * How often to retry `/version` while Headscale is unreachable.
   * Defaults to 30 seconds. Exposed for tests.
   */
  retryIntervalMs?: number;
}

const DEFAULT_RETRY_INTERVAL_MS = 30_000;

export async function createHeadscale(opts: CreateHeadscaleOptions): Promise<Headscale> {
  const transport = await createTransport({ url: opts.url, certPath: opts.certPath });
  const retryIntervalMs = opts.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS;

  let version: ServerVersion = parseServerVersion("unreachable");
  let capabilities: Capabilities = capabilitiesFor(version);
  let detected = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  async function detectOnce(): Promise<boolean> {
    try {
      const { version: raw } = await transport.getPublic<{ version: string }>("/version");
      const parsed = parseServerVersion(raw);
      version = parsed;
      capabilities = capabilitiesFor(parsed);
      detected = true;
      if (parsed.unknown) {
        log.warn(
          "api",
          "Could not parse Headscale version %s, assuming newest known capabilities",
          raw,
        );
      } else {
        log.info("api", "Connected to Headscale %s", formatServerVersion(parsed));
      }
      return true;
    } catch (error) {
      log.debug("api", "Headscale /version probe failed: %s", String(error));
      return false;
    }
  }

  function scheduleRetry() {
    if (disposed || detected) return;
    retryTimer = setTimeout(async () => {
      retryTimer = undefined;
      if (disposed) return;
      if (await detectOnce()) return;
      scheduleRetry();
    }, retryIntervalMs);
    // Don't keep the event loop alive on this timer alone — Headplane
    // should still shut down cleanly while we're waiting to retry.
    retryTimer.unref?.();
  }

  if (!(await detectOnce())) {
    log.warn(
      "api",
      "Headscale unreachable at boot; defaulting to newest-known capabilities and retrying every %dms",
      retryIntervalMs,
    );
    scheduleRetry();
  }

  return {
    // Getters so callers always observe the latest detected values
    // without having to know about the retry loop.
    get version() {
      return version;
    },
    get capabilities() {
      return capabilities;
    },
    health: () => transport.health(),
    client(apiKey) {
      return {
        nodes: makeNodeApi(transport, capabilities, apiKey),
        users: makeUserApi(transport, capabilities, apiKey),
        policy: makePolicyApi(transport, capabilities, apiKey),
        preAuthKeys: makePreAuthKeyApi(transport, capabilities, apiKey),
        apiKeys: makeApiKeyApi(transport, capabilities, apiKey),
      };
    },
    async dispose() {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      await transport.dispose();
    },
  };
}
