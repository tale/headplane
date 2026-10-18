// MARK: Headscale API
//
// The public entry point for talking to a Headscale server. At boot
// we try `GET /version` (unauthenticated, present since Headscale
// 0.27.0 — the minimum version Headplane supports) to derive a
// typed `Capabilities` object. Boot outcomes:
//
//   - success: parse the response, derive capabilities, done.
//   - 404: Headscale is reachable but predates 0.27.0 and is no
//     longer supported. Log an error and keep retrying so an
//     upgrade is picked up without a Headplane restart.
//   - any other failure (network, 5xx, parse): Headplane still
//     boots with `version = unknown` (capabilities-permissive) and
//     a background retry. This handles docker-compose start-order
//     races without making the whole process unhappy.
//
// Capabilities are always derived from `version`; once detection
// finishes there's no further state to track.

import log from "~/utils/log";

import { type Capabilities, capabilitiesFor } from "./capabilities";
import { isDataWithApiError } from "./error-client";
import { type ApiKeyApi, makeApiKeyApi } from "./resources/api-keys";
import { type AuthApi, makeAuthApi } from "./resources/auth";
import { makeNodeApi, type NodeApi } from "./resources/nodes";
import { makePolicyApi, type PolicyApi } from "./resources/policy";
import { makePreAuthKeyApi, type PreAuthKeyApi } from "./resources/pre-auth-keys";
import { makeUserApi, type UserApi } from "./resources/users";
import { formatServerVersion, parseServerVersion, type ServerVersion } from "./server-version";
import { createTransport } from "./transport";

const MIN_SUPPORTED_VERSION = "0.27.0";

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
  auth: AuthApi;
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

  function settle(parsed: ServerVersion) {
    version = parsed;
    capabilities = capabilitiesFor(parsed);
    detected = true;
    if (parsed.unknown) {
      log.warn(
        "api",
        "Could not parse Headscale version %s, assuming newest known capabilities",
        parsed.raw,
      );
    } else {
      log.info("api", "Connected to Headscale %s", formatServerVersion(parsed));
    }
  }

  async function detectOnce(): Promise<boolean> {
    try {
      const { version: raw } = await transport.getPublic<{ version: string }>("/version");
      settle(parseServerVersion(raw));
      return true;
    } catch (error) {
      // 404 means Headscale is reachable but predates 0.27.0 (where
      // /version was introduced). That server is below the supported
      // floor, so we don't settle — leave capabilities permissive and
      // keep retrying in case the operator upgrades in place.
      if (isDataWithApiError(error) && error.data.statusCode === 404) {
        log.error(
          "api",
          "Headscale /version returned 404; Headplane requires Headscale %s or newer",
          MIN_SUPPORTED_VERSION,
        );
        return false;
      }
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
        auth: makeAuthApi(transport, capabilities, apiKey),
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
