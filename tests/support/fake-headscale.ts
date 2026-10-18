import { randomBytes } from "node:crypto";

import { data } from "react-router";

import { createHeadscale } from "~/server/headscale/api";
import type { HeadscaleAPIError } from "~/server/headscale/api/error-client";
import type { Transport, TransportRequest } from "~/server/headscale/api/transport";

import type { HeadscaleVersion } from "../harness/versions";
import { LATEST_HEADSCALE } from "../harness/versions";

// An in-memory Headscale that answers at the wire level, so Headplane's real
// API client runs against it. It copies the responses and errors recorded
// from real Headscale, and the contract suite in tests/contract keeps the two
// in step. Anything it can't do should fail loudly, not guess.

const ZERO_TIME = "0001-01-01T00:00:00Z";
const TAGGED_DEVICES = {
  id: "2147455555",
  name: "tagged-devices",
  createdAt: ZERO_TIME,
  displayName: "Tagged Devices",
  email: "",
  providerId: "",
  provider: "",
  profilePicUrl: "",
};

const EXIT_ROUTES = new Set(["0.0.0.0/0", "::/0"]);

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
  givenName: string;
  userId: string | null;
  tags: string[];
  lastSeen: string;
  expiry: string | null;
  preAuthKeyId: string | null;
  createdAt: string;
  registerMethod: "REGISTER_METHOD_AUTH_KEY" | "REGISTER_METHOD_CLI" | "REGISTER_METHOD_OIDC";
  online: boolean;
  approvedRoutes: string[];
  availableRoutes: string[];
}

export interface JoinOptions {
  name: string;
  user?: string;
  tags?: string[];
  routes?: string[];
  exitNode?: boolean;
  online?: boolean;
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

function standardizeHuJson(input: string) {
  let output = "";
  let inString = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inString) {
      output += char;
      if (char === "\\") output += input[++i] ?? "";
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
    } else if (char === "/" && input[i + 1] === "/") {
      while (i < input.length && input[i] !== "\n") i++;
      output += "\n";
    } else if (char === "/" && input[i + 1] === "*") {
      i = input.indexOf("*/", i + 2);
      if (i === -1) throw new Error("unterminated block comment");
      i++;
    } else {
      output += char;
    }
  }

  return output.replace(/,(\s*[}\]])/g, "$1");
}

export type FakeHeadscale = ReturnType<typeof createFakeHeadscaleServer>;

export function createFakeHeadscaleServer(version: HeadscaleVersion = LATEST_HEADSCALE) {
  const hasStableKeyIds = gte(version, "0.28.0");
  const hasFlatTags = gte(version, "0.28.0");
  const hasNullExpiry = gte(version, "0.29.0");

  const users = new Map<string, UserRecord>();
  const keys = new Map<string, KeyRecord>();
  const nodes = new Map<string, NodeRecord>();
  const apiKeys = new Map<
    string,
    { id: string; prefix: string; expiration: string; createdAt: string }
  >();
  const pending = new Map<string, string>();
  let policy: { policy: string; updatedAt: string } | undefined;
  let isReachable = true;
  let nextIp = 1;
  const counters = { user: 0, key: 0, node: 0, apiKey: 0 };

  function nextId(kind: keyof typeof counters) {
    counters[kind] += 1;
    return String(counters[kind]);
  }

  function now() {
    return new Date().toISOString();
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

  function findNode(id: string) {
    return nodes.get(id) ?? fail(404, 5, "node not found");
  }

  function policyTagOwners(): Set<string> {
    if (!policy) return new Set();
    const parsed = JSON.parse(standardizeHuJson(policy.policy)) as { tagOwners?: object };
    return new Set(Object.keys(parsed.tagOwners ?? {}));
  }

  function assertTags(tags: string[], status: number, code: number) {
    if (tags.some((tag) => !tag.startsWith("tag:"))) {
      fail(status, code, "tag must start with the string 'tag:'");
    }
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

  // Real Headscale names a tagged node's owner differently in a list and in
  // a single-node read; see expectTaggedOwner in the contract.
  function nodeUser(record: NodeRecord, view: "list" | "read") {
    const owner = record.userId ? users.get(record.userId) : undefined;
    if (!hasFlatTags || record.tags.length === 0) return owner;
    if (view === "list") return TAGGED_DEVICES;
    return gte(version, "0.29.0") ? null : owner;
  }

  function serializeNode(record: NodeRecord, view: "list" | "read" = "read") {
    const preAuthKey = record.preAuthKeyId ? keys.get(record.preAuthKeyId) : undefined;
    const approved = new Set(record.approvedRoutes);
    const base = {
      id: record.id,
      machineKey: record.machineKey,
      nodeKey: record.nodeKey,
      discoKey: record.discoKey,
      ipAddresses: record.ipAddresses,
      name: record.name,
      user: nodeUser(record, view),
      lastSeen: record.lastSeen,
      expiry: record.expiry ?? (hasNullExpiry ? null : ZERO_TIME),
      preAuthKey: preAuthKey ? serializeKey(preAuthKey, true) : null,
      createdAt: record.createdAt,
      registerMethod: record.registerMethod,
    };

    const routes = {
      givenName: record.givenName,
      online: record.online,
      approvedRoutes: record.approvedRoutes,
      availableRoutes: record.availableRoutes,
      subnetRoutes: record.availableRoutes.filter(
        (route) => approved.has(route) && !EXIT_ROUTES.has(route),
      ),
    };

    if (hasFlatTags) {
      return { ...base, ...routes, tags: record.tags };
    }

    return { ...base, forcedTags: record.tags, invalidTags: [], validTags: [], ...routes };
  }

  function addNode(
    options: JoinOptions,
    method: NodeRecord["registerMethod"],
    keyId: string | null,
  ) {
    const userId = options.user ? findUserByName(options.user).id : null;
    if ([...nodes.values()].some((n) => n.givenName === options.name)) {
      fail(500, 2, `node name is not unique: ${options.name}`);
    }

    const id = nextId("node");
    const ip = nextIp++;
    const routes = [...(options.routes ?? [])];
    if (options.exitNode) routes.push("0.0.0.0/0", "::/0");

    const record: NodeRecord = {
      id,
      machineKey: `mkey:${hex(32)}`,
      nodeKey: `nodekey:${hex(32)}`,
      discoKey: `discokey:${hex(32)}`,
      ipAddresses: [`100.64.0.${ip}`, `fd7a:115c:a1e0::${ip.toString(16)}`],
      name: options.name,
      givenName: options.name,
      userId,
      tags: options.tags ?? [],
      lastSeen: now(),
      expiry: null,
      preAuthKeyId: keyId,
      createdAt: now(),
      registerMethod: method,
      online: options.online ?? true,
      approvedRoutes: [],
      availableRoutes: routes.sort(),
    };

    nodes.set(id, record);
    return record;
  }

  function validNodeName(name: string) {
    if (gte(version, "0.29.0")) {
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(name)) {
        fail(
          500,
          2,
          `renaming node: "${name}" is not a valid DNS label: "${name}" is not a valid DNS label: must end with a letter or number`,
        );
      }
      return;
    }

    if (name !== name.toLowerCase()) {
      fail(
        500,
        2,
        `renaming node: hostname "${name}" must be lowercase (try "${name.toLowerCase()}")`,
      );
    }
  }

  type Handler = (match: string[], request: TransportRequest, query: URLSearchParams) => unknown;
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
        if ([...users.values()].some((u) => u.name === body.name)) {
          const prefix = gte(version, "0.29.0") ? "creating user" : "failed to create user";
          fail(
            500,
            13,
            `${prefix}: creating user: constraint failed: UNIQUE constraint failed: users.name (2067)`,
          );
        }

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
      "POST",
      /^v1\/user\/([^/]+)\/rename\/([^/]+)$/,
      ([id, encoded]) => {
        const user = findUser(id);
        const name = decodeURIComponent(encoded);
        if ([...users.values()].some((u) => u.name === name && u.id !== id)) {
          fail(
            500,
            2,
            "updating user: constraint failed: UNIQUE constraint failed: users.name (2067)",
          );
        }

        user.name = name;
        return { user };
      },
    ],
    [
      "DELETE",
      /^v1\/user\/([^/]+)$/,
      ([id]) => {
        findUser(id);
        const owned = [...nodes.values()].filter((n) => n.userId === id);
        const blocking = gte(version, "0.29.0")
          ? owned.filter((n) => n.tags.length === 0 || !hasFlatTags)
          : owned;
        if (blocking.length > 0) fail(500, 2, "user not empty: node(s) found");

        users.delete(id);
        // An upstream 0.28.0 bug: deleting any user deletes every auth key.
        if (version === "0.28.0") keys.clear();
        return {};
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

        const aclTags = body.aclTags ?? [];
        if (!body.user && !hasStableKeyIds) fail(500, 2, "user not found");
        assertTags(aclTags, 400, 3);
        if (body.user) findUser(body.user);

        const record: KeyRecord = {
          id: nextId("key"),
          key: hasStableKeyIds ? `hskey-auth-${token(12)}-${token(64)}` : hex(24),
          userId: body.user ?? null,
          reusable: body.reusable,
          ephemeral: body.ephemeral,
          used: false,
          expiration: body.expiration ?? ZERO_TIME,
          createdAt: now(),
          aclTags,
        };

        keys.set(record.id, record);
        return { preAuthKey: serializeKey(record, false) };
      },
    ],
    [
      "POST",
      /^v1\/preauthkey\/expire$/,
      (_, request) => {
        const body = request.body as { id?: string; user?: string; key?: string };
        const record =
          hasStableKeyIds && body.id
            ? keys.get(body.id)
            : [...keys.values()].find((k) => k.userId === body.user && k.key === body.key);

        if (!record) fail(500, 2, "AuthKey not found");
        record!.expiration = now();
        return {};
      },
    ],
    [
      "GET",
      /^v1\/policy$/,
      () => {
        return policy ?? fail(500, 2, "loading ACL from database: acl policy not found");
      },
    ],
    [
      "PUT",
      /^v1\/policy$/,
      (_, request) => {
        const text = (request.body as { policy: string }).policy;
        try {
          JSON.parse(standardizeHuJson(text));
        } catch (error) {
          fail(
            500,
            2,
            `setting policy: parsing policy: parsing HuJSON: ${(error as Error).message}`,
          );
        }

        policy = { policy: text, updatedAt: now() };
        return policy;
      },
    ],
    [
      "GET",
      /^v1\/node$/,
      () => ({
        nodes: [...nodes.values()].map((node) => serializeNode(node, "list")),
      }),
    ],
    ["GET", /^v1\/node\/(\d+)$/, ([id]) => ({ node: serializeNode(findNode(id)) })],
    [
      "DELETE",
      /^v1\/node\/(\d+)$/,
      ([id]) => {
        findNode(id);
        nodes.delete(id);
        return {};
      },
    ],
    [
      "POST",
      /^v1\/node\/(\d+)\/rename\/([^/]+)$/,
      ([id, encoded]) => {
        const record = findNode(id);
        const name = decodeURIComponent(encoded);
        validNodeName(name);
        if ([...nodes.values()].some((n) => n.givenName === name && n.id !== id)) {
          fail(500, 2, `${hasFlatTags ? "node name" : "name"} is not unique: ${name}`);
        }

        record.givenName = name;
        return { node: serializeNode(record) };
      },
    ],
    [
      "POST",
      /^v1\/node\/(\d+)\/tags$/,
      ([id], request) => {
        const record = findNode(id);
        const tags = (request.body as { tags: string[] }).tags;
        assertTags(tags, 500, 2);
        if (hasFlatTags) {
          const owners = policyTagOwners();
          const unknown = tags.filter((tag) => !owners.has(tag));
          if (unknown.length > 0) {
            fail(400, 3, `requested tags [${unknown.join(" ")}] are invalid or not permitted`);
          }
        }

        record.tags = tags;
        return { node: serializeNode(record) };
      },
    ],
    [
      "POST",
      /^v1\/node\/(\d+)\/approve_routes$/,
      ([id], request) => {
        const record = findNode(id);
        record.approvedRoutes = [...(request.body as { routes: string[] }).routes].sort();
        return { node: serializeNode(record) };
      },
    ],
    [
      "POST",
      /^v1\/node\/(\d+)\/expire$/,
      ([id], _, query) => {
        const record = findNode(id);
        if (gte(version, "0.29.0") && query.get("disableExpiry") === "true") {
          record.expiry = null;
          return { node: serializeNode(record) };
        }

        const expiry = query.get("expiry");
        if (expiry && new Date(expiry).getTime() > Date.now()) {
          record.expiry = expiry;
          return { node: serializeNode(record) };
        }

        record.expiry = now();
        if (gte(version, "0.29.0")) record.online = false;
        return { node: serializeNode(record) };
      },
    ],
    [
      "POST",
      /^v1\/node\/(\d+)\/user$/,
      ([id], request) => {
        if (hasFlatTags) fail(404, 5, "Not Found");
        const record = findNode(id);
        record.userId = findUser((request.body as { user: string }).user).id;
        return { node: serializeNode(record) };
      },
    ],
    [
      "POST",
      /^v1\/node\/register$/,
      (_, request) => {
        const body = request.body as { user: string; key: string };
        if (gte(version, "0.29.0")) {
          if (!body.key.startsWith("hskey-authreq-")) {
            fail(500, 2, 'auth ID has invalid prefix: expected prefix "hskey-authreq-"');
          }
        } else if (body.key.length !== 24) {
          fail(500, 2, "registration ID must be 24 characters long");
        }

        const name = pending.get(body.key) ?? fail(500, 2, "node not found in registration cache");
        pending.delete(body.key);
        return {
          node: serializeNode(
            addNode({ name, user: body.user, online: false }, "REGISTER_METHOD_CLI", null),
          ),
        };
      },
    ],
  ];

  const apiKey = createApiKey();

  const transport: Transport = {
    async request<T>(request: TransportRequest): Promise<T> {
      const label = `${request.method} ${request.path}` as const;
      if (!isReachable) {
        throw data(
          {
            requestUrl: label,
            errorCode: "ECONNREFUSED",
            errorMessage: "connect ECONNREFUSED",
            extraData: null,
          },
          { status: 502, statusText: "Bad Gateway" },
        );
      }

      if (!apiKeys.has(request.apiKey)) {
        throw apiError(label, 401, "Unauthorized", null);
      }

      const [path, search = ""] = request.path.split("?");
      const query = new URLSearchParams(search);
      for (const [method, pattern, handler] of routes) {
        const match = path.match(pattern);
        if (method !== request.method || !match) continue;

        try {
          return structuredClone(handler(match.slice(1), request, query)) as T;
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
        throw data(
          {
            requestUrl: `GET ${path}`,
            errorCode: "ECONNREFUSED",
            errorMessage: "connect ECONNREFUSED",
            extraData: null,
          },
          { status: 502, statusText: "Bad Gateway" },
        );
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
      const user = options.user ? findUserByName(options.user) : undefined;
      if (!user && !hasStableKeyIds) {
        throw new Error(`Headscale ${version} can't join tag-only nodes`);
      }

      const key: KeyRecord = {
        id: nextId("key"),
        key: hasStableKeyIds ? `hskey-auth-${token(12)}-${token(64)}` : hex(24),
        userId: user?.id ?? null,
        reusable: false,
        ephemeral: false,
        used: true,
        expiration: new Date(Date.now() + 3_600_000).toISOString(),
        createdAt: now(),
        aclTags: options.tags ?? [],
      };

      keys.set(key.id, key);
      return { id: addNode(options, "REGISTER_METHOD_AUTH_KEY", key.id).id };
    },

    // Returns the key a waiting Tailscale client prints in its register URL.
    pendingNode(name: string) {
      const id = token(24);
      const key = gte(version, "0.29.0") ? `hskey-authreq-${id}` : id;
      pending.set(key, name);
      return { registerKey: key, registerUrl: `http://headscale:8080/register/${key}` };
    },

    setOnline(id: string, online: boolean) {
      findNode(id).online = online;
    },

    setReachable(reachable: boolean) {
      isReachable = reachable;
    },
  };
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
