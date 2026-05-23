// MARK: Headscale Transport
//
// Internal HTTP transport for talking to a Headscale server. Owns
// the Undici agent (and any custom CA), the base URL, error
// translation, and the distinction between authenticated `/api/v1`
// calls and unauthenticated public endpoints (`/version`, `/health`).
//
// This module is intentionally not exported from the package; all
// consumers should go through `Headscale` and `HeadscaleClient` in
// `./index.ts`, never the transport directly.

import { readFile } from "node:fs/promises";

import { data } from "react-router";
import { Agent, type Dispatcher, request } from "undici";

import log from "~/utils/log";

import { undiciToFriendlyError } from "./error";
import { type HeadscaleAPIError, isApiError } from "./error-client";

export interface TransportRequest {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** API path without the `/api/` prefix (e.g. `v1/node`). */
  path: `v1/${string}`;
  apiKey: string;
  /** JSON request body for non-GET/DELETE requests. */
  body?: Record<string, unknown>;
  /** Query parameters for GET/DELETE requests. */
  query?: Record<string, unknown>;
}

export interface Transport {
  /**
   * Send an authenticated JSON request against `/api/{path}`.
   * Throws a React Router `data()` 502 response on transport errors
   * and a typed `HeadscaleAPIError` (wrapped in `data()`) on API
   * errors with statusCode >= 400.
   */
  request<T>(opts: TransportRequest): Promise<T>;

  /**
   * Send an unauthenticated GET against the server root
   * (e.g. `/version`, `/health`). Returns parsed JSON.
   */
  getPublic<T>(path: `/${string}`): Promise<T>;

  /** True if `GET /health` returns 200. Never throws. */
  health(): Promise<boolean>;

  /** Shut down the underlying Undici agent. */
  dispose(): Promise<void>;
}

export interface TransportOptions {
  url: string;
  certPath?: string;
}

export async function createTransport(opts: TransportOptions): Promise<Transport> {
  const agent = await createUndiciAgent(opts.certPath);
  const baseUrl = opts.url;

  async function rawRequest(
    url: string,
    options: Partial<Dispatcher.RequestOptions> & { method: string },
  ): Promise<Dispatcher.ResponseData> {
    log.debug("api", "%s %s", options.method, url);
    try {
      return await request(new URL(url, baseUrl), {
        dispatcher: agent,
        headers: {
          ...options.headers,
          Accept: "application/json",
          "User-Agent": `Headplane/${__VERSION__}`,
        },
        body: options.body,
        method: options.method,
      });
    } catch (error) {
      const errorBody = undiciToFriendlyError(error, `${options.method} ${url}`);
      throw data(errorBody, { status: 502, statusText: "Bad Gateway" });
    }
  }

  return {
    async request<T>({ method, path, apiKey, body, query }: TransportRequest): Promise<T> {
      let url = `/api/${path}`;
      const options: Partial<Dispatcher.RequestOptions> & { method: string } = {
        method,
        headers: { Authorization: `Bearer ${apiKey}` },
      };

      if (query && (method === "GET" || method === "DELETE")) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
          if (value !== undefined) {
            params.append(key, String(value));
          }
        }
        if ([...params.keys()].length > 0) {
          url += `?${params.toString()}`;
        }
      } else if (body && method !== "GET" && method !== "DELETE") {
        options.body = JSON.stringify(body);
        options.headers = { ...options.headers, "Content-Type": "application/json" };
      }

      const res = await rawRequest(url, options);
      if (res.statusCode >= 400) {
        log.debug("api", "%s %s failed with status %d", method, path, res.statusCode);
        const rawData = await res.body.text();
        const jsonData = (() => {
          try {
            return JSON.parse(rawData) as Record<string, unknown>;
          } catch {
            return null;
          }
        })();

        throw data(
          {
            requestUrl: `${method} ${path}`,
            statusCode: res.statusCode,
            rawData,
            data: jsonData,
          } satisfies HeadscaleAPIError,
          { status: 502, statusText: "Bad Gateway" },
        );
      }

      return res.body.json() as Promise<T>;
    },

    async getPublic<T>(path: `/${string}`): Promise<T> {
      const res = await rawRequest(path, { method: "GET" });
      if (res.statusCode >= 400) {
        const rawData = await res.body.text();
        const jsonData = (() => {
          try {
            return JSON.parse(rawData) as Record<string, unknown>;
          } catch {
            return null;
          }
        })();
        throw data(
          {
            requestUrl: `GET ${path}`,
            statusCode: res.statusCode,
            rawData,
            data: jsonData,
          } satisfies HeadscaleAPIError,
          { status: 502, statusText: "Bad Gateway" },
        );
      }
      return res.body.json() as Promise<T>;
    },

    async health() {
      try {
        const res = await rawRequest("/health", { method: "GET" });
        // Drain the body so the connection can be reused.
        await res.body.dump();
        return res.statusCode === 200;
      } catch (error) {
        if (isApiError(error)) {
          log.debug("api", "Health check failed: %d", error.statusCode);
        }
        return false;
      }
    },

    async dispose() {
      await agent.close();
    },
  };
}

async function createUndiciAgent(certPath?: string): Promise<Agent> {
  if (!certPath) return new Agent();
  try {
    log.debug("config", "Loading certificate from %s", certPath);
    const cert = await readFile(certPath, "utf8");
    log.info("config", "Using certificate from %s", certPath);
    return new Agent({ connect: { ca: cert.trim() } });
  } catch (error) {
    log.error("config", "Failed to load Headscale TLS cert: %s", error);
    log.debug("config", "Error Details: %o", error);
    return new Agent();
  }
}
