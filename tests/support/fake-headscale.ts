import { randomBytes } from "node:crypto";

import { data } from "react-router";

import { createHeadscale } from "~/server/headscale/api";
import type { HeadscaleAPIError } from "~/server/headscale/api/error-client";
import type { Transport, TransportRequest } from "~/server/headscale/api/transport";

import type { HeadscaleVersion } from "../harness/versions";
import { LATEST_HEADSCALE } from "../harness/versions";

// Wire-level, so Headplane's real client runs on it. It only models what unit
// tests use; the fake half of tests/contract keeps that honest.

const ZERO_TIME = "0001-01-01T00:00:00Z";

interface UserRecord {
  id: string;
  name: string;
  createdAt: string;
  displayName: string;
  email: string;
  providerId: string;
  provider: string;
  profilePicUrl: string;
}

interface KeyRecord {
  id: string;
  key: string;
  userId: string | null;
  reusable: boolean;
  ephemeral: boolean;
  used: boolean;
  expiration: string;
  createdAt: string;
  aclTags: string[];
}

interface NodeRecord {
  id: string;
  machineKey: string;
  nodeKey: string;
  discoKey: string;
  ipAddresses: string[];
  name: string;
  userId: string;
  preAuthKeyId: string;
  createdAt: string;
  availableRoutes: string[];
}

export interface JoinOptions {
  name: string;
  user: string;
  routes?: string[];
  exitNode?: boolean;
}

class HeadscaleError {
  constructor(
    readonly status: number,
    readonly code: number,
    readonly message: string,
  ) {}
}

const fail = (status: number, code: number, message: string): never => {
  throw new HeadscaleError(status, code, message);
};

function gte(version: HeadscaleVersion, target: string) {
  const [a, b, c] = version.split(".").map(Number);
  const [x, y, z] = target.split(".").map(Number);
  return a !== x ? a > x : b !== y ? b > y : c >= z;
}

function hex(bytes: number) {
  return randomBytes(bytes).toString("hex");
}

function token(length: number) {
  return randomBytes(length).toString("base64url").slice(0, length);
}

export type FakeHeadscale = ReturnType<typeof createFakeHeadscaleServer>;

export function createFakeHeadscaleServer(version: HeadscaleVersion = LATEST_HEADSCALE) {
  const hasStableKeyIds = gte(version, "0.28.0");
  const hasNullExpiry = gte(version, "0.29.0");

  const users = new Map<string, UserRecord>();
  const keys = new Map<string, KeyRecord>();
  const nodes = new Map<string, NodeRecord>();
  const apiKeys = new Map<
    string,
    { id: string; prefix: string; expiration: string; createdAt: string }
  >();
  let isReachable = true;
  const counters = { user: 0, key: 0, node: 0, apiKey: 0 };

  function nextId(kind: keyof typeof counters) {
    counters[kind] += 1;
    return String(counters[kind]);
  }

  function now() {
    return new Date().toISOString();
  }

  function authKey() {
    return hasStableKeyIds ? `hskey-auth-${token(12)}-${token(64)}` : hex(24);
  }

  function createApiKey() {
    const id = nextId("apiKey");
    const secret = hasStableKeyIds
      ? `hskey-api-${token(12)}-${token(64)}`
      : `${token(7)}.${token(32)}`;
    const prefix = hasStableKeyIds ? `${secret.slice(0, 22)}-***` : secret.slice(0, 7);
    apiKeys.set(secret, {
      id,
      prefix,
      expiration: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      createdAt: now(),
    });

    return secret;
  }

  function findUser(id: string) {
    return users.get(id) ?? fail(500, 2, "user not found");
  }

  function findUserByName(name: string) {
    return [...users.values()].find((u) => u.name === name) ?? fail(500, 2, "user not found");
  }

  function serializeKey(record: KeyRecord, masked: boolean) {
    const key = masked && hasStableKeyIds ? `${record.key.slice(0, 23)}-***` : record.key;
    return {
      user: record.userId ? (users.get(record.userId) ?? null) : null,
      id: record.id,
      key,
      reusable: record.reusable,
      ephemeral: record.ephemeral,
      used: record.used,
      expiration: record.expiration,
      createdAt: record.createdAt,
      aclTags: record.aclTags,
    };
  }

  function serializeNode(record: NodeRecord) {
    const routes = {
      givenName: record.name,
      online: true,
      approvedRoutes: [],
      availableRoutes: record.availableRoutes,
    };

    const base = {
      id: record.id,
      machineKey: record.machineKey,
      nodeKey: record.nodeKey,
      discoKey: record.discoKey,
      ipAddresses: record.ipAddresses,
      name: record.name,
      user: users.get(record.userId),
      lastSeen: record.createdAt,
      expiry: hasNullExpiry ? null : ZERO_TIME,
      preAuthKey: serializeKey(keys.get(record.preAuthKeyId)!, true),
      createdAt: record.createdAt,
      registerMethod: "REGISTER_METHOD_AUTH_KEY",
    };

    if (hasStableKeyIds) {
      return { ...base, ...routes, tags: [] };
    }

    return { ...base, forcedTags: [], invalidTags: [], validTags: [], ...routes };
  }

  type Handler = (match: string[], request: TransportRequest) => unknown;
  const routes: Array<[TransportRequest["method"], RegExp, Handler]> = [
    [
      "GET",
      /^v1\/user$/,
      (_, request) => {
        const filter = request.query ?? {};
        const list = [...users.values()].filter(
          (u) =>
            (filter.id === undefined || u.id === filter.id) &&
            (filter.name === undefined || u.name === filter.name) &&
            (filter.email === undefined || u.email === filter.email),
        );
        return { users: list };
      },
    ],
    [
      "POST",
      /^v1\/user$/,
      (_, request) => {
        const body = request.body as {
          name: string;
          email?: string;
          displayName?: string;
          pictureUrl?: string;
        };

        const user: UserRecord = {
          id: nextId("user"),
          name: body.name,
          createdAt: now(),
          displayName: body.displayName ?? "",
          email: body.email ?? "",
          providerId: "",
          provider: "",
          profilePicUrl: body.pictureUrl ?? "",
        };

        users.set(user.id, user);
        return { user };
      },
    ],
    [
      "GET",
      /^v1\/apikey$/,
      () => ({
        apiKeys: [...apiKeys.values()].map((key) => ({ ...key, lastSeen: null })),
      }),
    ],
    [
      "GET",
      /^v1\/preauthkey$/,
      (_, request) => {
        const userId = request.query?.user as string | undefined;
        if (userId === undefined && !hasStableKeyIds) fail(500, 2, "user not found");
        if (userId !== undefined) findUser(userId);

        // 0.28+ ignores the user filter.
        const list = [...keys.values()].filter(
          (k) => hasStableKeyIds || userId === undefined || k.userId === userId,
        );
        return { preAuthKeys: list.map((k) => serializeKey(k, true)) };
      },
    ],
    [
      "POST",
      /^v1\/preauthkey$/,
      (_, request) => {
        const body = request.body as {
          user?: string;
          reusable: boolean;
          ephemeral: boolean;
          expiration: string | null;
          aclTags?: string[];
        };

        if (!body.user && !hasStableKeyIds) fail(500, 2, "user not found");
        if (body.user) findUser(body.user);

        const record: KeyRecord = {
          id: nextId("key"),
          key: authKey(),
          userId: body.user ?? null,
          reusable: body.reusable,
          ephemeral: body.ephemeral,
          used: false,
          expiration: body.expiration ?? ZERO_TIME,
          createdAt: now(),
          aclTags: body.aclTags ?? [],
        };

        keys.set(record.id, record);
        return { preAuthKey: serializeKey(record, false) };
      },
    ],
    ["GET", /^v1\/node$/, () => ({ nodes: [...nodes.values()].map(serializeNode) })],
    [
      "GET",
      /^v1\/node\/(\d+)$/,
      ([id]) => ({ node: serializeNode(nodes.get(id) ?? fail(404, 5, "node not found")) }),
    ],
  ];

  const apiKey = createApiKey();

  const transport: Transport = {
    async request<T>(request: TransportRequest): Promise<T> {
      const label = `${request.method} ${request.path}` as const;
      if (!isReachable) {
        throw transportError(label, "ECONNREFUSED", "connect ECONNREFUSED");
      }

      // Undici refuses to send a header with these, as the real transport does.
      if (!/^[\x20-\x7e]*$/.test(request.apiKey)) {
        throw transportError(label, "UND_ERR_INVALID_ARG", "invalid Authorization header");
      }

      if (!apiKeys.has(request.apiKey)) {
        throw apiError(label, 401, "Unauthorized", null);
      }

      const [path] = request.path.split("?");
      for (const [method, pattern, handler] of routes) {
        const match = path.match(pattern);
        if (method !== request.method || !match) continue;

        try {
          return structuredClone(handler(match.slice(1), request)) as T;
        } catch (error) {
          if (!(error instanceof HeadscaleError)) throw error;
          const body = { code: error.code, message: error.message, details: [] };
          throw apiError(label, error.status, JSON.stringify(body), body);
        }
      }

      throw new Error(`Fake Headscale doesn't implement ${label}`);
    },

    async getPublic<T>(path: `/${string}`): Promise<T> {
      if (!isReachable) {
        throw transportError(`GET ${path}`, "ECONNREFUSED", "connect ECONNREFUSED");
      }

      if (path !== "/version") throw new Error(`Fake Headscale doesn't implement GET ${path}`);
      return { version: `v${version}` } as T;
    },

    async health() {
      return isReachable;
    },

    async dispose() {},
  };

  return {
    version,
    apiKey,
    transport,
    createApiKey,

    // Joins a node the way a Tailscale client with a pre-auth key would.
    join(options: JoinOptions) {
      const user = findUserByName(options.user);
      const key: KeyRecord = {
        id: nextId("key"),
        key: authKey(),
        userId: user.id,
        reusable: false,
        ephemeral: false,
        used: true,
        expiration: new Date(Date.now() + 3_600_000).toISOString(),
        createdAt: now(),
        aclTags: [],
      };
      keys.set(key.id, key);

      const id = nextId("node");
      const routes = [...(options.routes ?? [])];
      if (options.exitNode) routes.push("0.0.0.0/0", "::/0");

      nodes.set(id, {
        id,
        machineKey: `mkey:${hex(32)}`,
        nodeKey: `nodekey:${hex(32)}`,
        discoKey: `discokey:${hex(32)}`,
        ipAddresses: [`100.64.0.${id}`, `fd7a:115c:a1e0::${Number(id).toString(16)}`],
        name: options.name,
        userId: user.id,
        preAuthKeyId: key.id,
        createdAt: now(),
        availableRoutes: routes.sort(),
      });

      return { id };
    },

    setReachable(reachable: boolean) {
      isReachable = reachable;
    },
  };
}

function transportError(requestUrl: `${string} ${string}`, errorCode: string, message: string) {
  return data(
    { requestUrl, errorCode, errorMessage: message, extraData: null },
    { status: 502, statusText: "Bad Gateway" },
  );
}

function apiError(
  requestUrl: `${string} ${string}`,
  statusCode: number,
  rawData: string,
  body: Record<string, unknown> | null,
) {
  return data({ requestUrl, statusCode, rawData, data: body } satisfies HeadscaleAPIError, {
    status: 502,
    statusText: "Bad Gateway",
  });
}

// A `Headscale` backed by the fake, built through Headplane's own factory.
export async function createFakeHeadscale(version: HeadscaleVersion = LATEST_HEADSCALE) {
  const server = createFakeHeadscaleServer(version);
  const headscale = await createHeadscale({
    url: "http://fake-headscale",
    transport: server.transport,
  });
  return { server, headscale, api: headscale.client(server.apiKey) };
}
