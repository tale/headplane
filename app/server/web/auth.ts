import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";

import { eq, lt, sql } from "drizzle-orm";
import { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { createCookie } from "react-router";
import { ulid } from "ulidx";

import type { Machine } from "~/types";

import { type HeadplaneUser, authSessions, users } from "../db/schema";
import { Capabilities, type Role, Roles, capsForRole } from "./roles";

export type Principal =
  | {
      kind: "api_key";
      sessionId: string;
      displayName: string;
      apiKey: string;
    }
  | UserPrincipal;

export type UserPrincipal = {
  kind: "oidc" | "proxy";
  sessionId: string;
  idToken?: string;
  user: {
    id: string;
    subject: string;
    role: Role;
    headscaleUserId: string | undefined;
  };
  profile: {
    name: string;
    email?: string;
    username?: string;
    picture?: string;
  };
};

interface ProxyAuthOptions {
  enabled: boolean;
  allowedCidrs?: string[];
  trustedProxyCidrs?: string[];
  ipHeader?: string;
  userHeader?: string;
  emailHeader?: string;
  nameHeader?: string;
  pictureHeader?: string;
}

interface CookiePayload {
  sid: string;
  api_key?: string;
  profile?: {
    name: string;
    email?: string;
    username?: string;
  };
}

export interface AuthServiceOptions {
  secret: string;
  headscaleApiKey?: string;
  proxyAuth?: ProxyAuthOptions;
  db: NodeSQLiteDatabase;
  cookie: {
    name: string;
    secure: boolean;
    maxAge: number;
    domain?: string;
  };
}

export interface AuthService {
  registerRequestClientAddress(request: Request, address: string | undefined): void;
  require(request: Request): Promise<Principal>;
  can(principal: Principal, capabilities: Capabilities): boolean;
  canManageNode(principal: Principal, node: Machine): boolean;
  getHeadscaleApiKey(principal: Principal): string;
  createOidcSession(
    userId: string,
    profile: NonNullable<CookiePayload["profile"]>,
    options?: { idToken?: string; maxAge?: number },
  ): Promise<string>;

  createApiKeySession(apiKey: string, displayName: string, maxAge: number): Promise<string>;
  destroySession(request?: Request): Promise<string>;
  findOrCreateUser(
    subject: string,
    profile?: { name?: string; email?: string; picture?: string },
    options?: { initialRole?: string; syncRole?: string },
  ): Promise<string>;

  linkHeadscaleUser(userId: string, headscaleUserId: string): Promise<boolean>;
  unlinkHeadscaleUser(userId: string): Promise<void>;
  listUsers(): Promise<HeadplaneUser[]>;
  claimedHeadscaleUserIds(): Promise<Set<string>>;
  roleForSubject(subject: string): Promise<Role | undefined>;
  roleForHeadscaleUser(headscaleUserId: string): Promise<Role | undefined>;
  transferOwnership(currentOwnerUserId: string, newOwnerUserId: string): Promise<boolean>;
  reassignUser(userId: string, role: Role): Promise<boolean>;
  pruneExpiredSessions(): Promise<void>;
  start(): void;
  stop(): void;
}

export function isUserPrincipal(principal: Principal): principal is UserPrincipal {
  return principal.kind === "oidc" || principal.kind === "proxy";
}

interface CidrRange {
  family: 4 | 6;
  base: bigint;
  mask: bigint;
}

const DEFAULT_PROXY_AUTH_CIDRS = ["127.0.0.1/32", "::1/128"];
const DEFAULT_PROXY_AUTH_USER_HEADER = "Remote-User";

function normalizeIpAddress(address: string): string {
  if (address.startsWith("::ffff:")) {
    const mapped = address.slice("::ffff:".length);
    if (isIP(mapped) === 4) {
      return mapped;
    }
  }

  return address;
}

function parseIpv4(address: string): bigint | undefined {
  const parts = address.split(".");
  if (parts.length !== 4) {
    return;
  }

  let value = 0n;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return;
    }

    const byte = Number(part);
    if (byte < 0 || byte > 255) {
      return;
    }

    value = (value << 8n) + BigInt(byte);
  }

  return value;
}

function parseIpv6(address: string): bigint | undefined {
  const sections = address.split("::");
  if (sections.length > 2) {
    return;
  }

  const head = sections[0] ? sections[0].split(":") : [];
  const tail = sections.length === 2 && sections[1] ? sections[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (sections.length === 1 && missing !== 0)) {
    return;
  }

  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  if (groups.length !== 8) {
    return;
  }

  let value = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
      return;
    }

    value = (value << 16n) + BigInt(parseInt(group, 16));
  }

  return value;
}

function parseIpAddress(address: string): { family: 4 | 6; value: bigint } | undefined {
  const normalized = normalizeIpAddress(address);
  const family = isIP(normalized);
  if (family === 4) {
    const value = parseIpv4(normalized);
    return value === undefined ? undefined : { family, value };
  }
  if (family === 6) {
    const value = parseIpv6(normalized);
    return value === undefined ? undefined : { family, value };
  }

  return;
}

function parseCidr(cidr: string): CidrRange {
  const parts = cidr.trim().split("/");
  if (parts.length > 2) {
    throw new Error(`Invalid proxy auth CIDR: ${cidr}`);
  }

  const [rawAddress, rawPrefix] = parts;
  const address = parseIpAddress(rawAddress);
  if (!address) {
    throw new Error(`Invalid proxy auth CIDR address: ${cidr}`);
  }

  const maxBits = address.family === 4 ? 32 : 128;
  const prefix = rawPrefix === undefined ? maxBits : Number(rawPrefix);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxBits) {
    throw new Error(`Invalid proxy auth CIDR prefix: ${cidr}`);
  }

  const bits = BigInt(maxBits);
  const hostBits = BigInt(maxBits - prefix);
  const allOnes = (1n << bits) - 1n;
  const mask = prefix === 0 ? 0n : (allOnes << hostBits) & allOnes;

  return {
    family: address.family,
    base: address.value & mask,
    mask,
  };
}

function cidrContains(range: CidrRange, address: string): boolean {
  const parsed = parseIpAddress(address);
  if (!parsed || parsed.family !== range.family) {
    return false;
  }

  return (parsed.value & range.mask) === range.base;
}

export function createAuthService(opts: AuthServiceOptions): AuthService {
  const requestCache = new WeakMap<Request, Promise<Principal>>();
  const clientAddresses = new WeakMap<Request, string>();
  const proxyAuthCidrs = opts.proxyAuth?.enabled
    ? (opts.proxyAuth.allowedCidrs?.length
        ? opts.proxyAuth.allowedCidrs
        : DEFAULT_PROXY_AUTH_CIDRS
      ).map(parseCidr)
    : [];
  const trustedProxyCidrs = opts.proxyAuth?.enabled
    ? (opts.proxyAuth.trustedProxyCidrs?.length
        ? opts.proxyAuth.trustedProxyCidrs
        : DEFAULT_PROXY_AUTH_CIDRS
      ).map(parseCidr)
    : [];
  let pruneTimer: ReturnType<typeof setInterval> | undefined;

  async function encodeCookie(payload: CookiePayload, maxAge: number): Promise<string> {
    const cookie = createCookie(opts.cookie.name, {
      ...opts.cookie,
      path: __PREFIX__,
      maxAge,
    });

    const signed = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const hmac = createHmac("sha256", opts.secret).update(signed).digest("base64url");
    return cookie.serialize(`${signed}.${hmac}`);
  }

  async function decodeCookie(request: Request): Promise<CookiePayload> {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) {
      throw new Error("No session cookie found");
    }

    const cookie = createCookie(opts.cookie.name, {
      ...opts.cookie,
      path: __PREFIX__,
    });

    const raw = (await cookie.parse(cookieHeader)) as string | null;
    if (!raw) {
      throw new Error("Session cookie is empty");
    }

    const dotIndex = raw.lastIndexOf(".");
    if (dotIndex === -1) {
      throw new Error("Malformed session cookie");
    }

    const signed = raw.slice(0, dotIndex);
    const hmac = raw.slice(dotIndex + 1);
    const expected = createHmac("sha256", opts.secret).update(signed).digest("base64url");

    if (hmac !== expected) {
      throw new Error("Invalid session cookie signature");
    }

    return JSON.parse(Buffer.from(signed, "base64url").toString("utf-8")) as CookiePayload;
  }

  function hashApiKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }

  function registerRequestClientAddress(request: Request, address: string | undefined): void {
    if (address) {
      clientAddresses.set(request, address);
    }
  }

  function getForwardedClientAddress(request: Request): string | undefined {
    const headerName = opts.proxyAuth?.ipHeader;
    if (!headerName) {
      return;
    }

    const value = request.headers.get(headerName)?.trim();
    if (!value) {
      return;
    }

    const first = value.split(",")[0]?.trim();
    if (!first) {
      return;
    }

    return parseIpAddress(first) ? first : undefined;
  }

  function getProxyAuthClientAddress(request: Request): string | undefined {
    const directAddress = clientAddresses.get(request);
    if (!directAddress) {
      return;
    }

    if (!opts.proxyAuth?.ipHeader) {
      return directAddress;
    }

    const directPeerTrusted = trustedProxyCidrs.some((cidr) => cidrContains(cidr, directAddress));
    if (!directPeerTrusted) {
      return;
    }

    return getForwardedClientAddress(request);
  }

  async function resolveUserPrincipal(options: {
    kind: UserPrincipal["kind"];
    sessionId: string;
    userId: string;
    idToken?: string;
    profile?: {
      name?: string;
      email?: string;
      username?: string;
    };
  }): Promise<UserPrincipal> {
    const [user] = await opts.db.select().from(users).where(eq(users.id, options.userId)).limit(1);

    if (!user) {
      throw new Error("User record not found");
    }

    const role = (user.role in Roles ? user.role : "member") as Role;
    return {
      kind: options.kind,
      sessionId: options.sessionId,
      idToken: options.idToken,
      user: {
        id: user.id,
        subject: user.sub,
        role,
        headscaleUserId: user.headscale_user_id ?? undefined,
      },
      profile: {
        name: options.profile?.name ?? user.name ?? user.sub,
        email: options.profile?.email ?? user.email ?? undefined,
        username: options.profile?.username,
        picture: user.picture ?? undefined,
      },
    };
  }

  async function resolveProxyAuthPrincipal(request: Request): Promise<Principal | undefined> {
    if (!opts.proxyAuth?.enabled) {
      return;
    }
    if (!opts.headscaleApiKey) {
      throw new Error("Proxy authentication requires headscale.api_key to be configured");
    }

    const clientAddress = getProxyAuthClientAddress(request);
    if (!clientAddress || !proxyAuthCidrs.some((cidr) => cidrContains(cidr, clientAddress))) {
      return;
    }

    const userHeader = opts.proxyAuth.userHeader ?? DEFAULT_PROXY_AUTH_USER_HEADER;
    const proxyUser = request.headers.get(userHeader)?.trim();
    if (!proxyUser) {
      return;
    }

    const email = opts.proxyAuth.emailHeader
      ? request.headers.get(opts.proxyAuth.emailHeader)?.trim()
      : undefined;
    const name = opts.proxyAuth.nameHeader
      ? request.headers.get(opts.proxyAuth.nameHeader)?.trim()
      : undefined;
    const picture = opts.proxyAuth.pictureHeader
      ? request.headers.get(opts.proxyAuth.pictureHeader)?.trim()
      : undefined;
    const subject = `proxy:${proxyUser}`;
    const userId = await findOrCreateUser(subject, {
      name: name || proxyUser,
      email: email || undefined,
      picture: picture || undefined,
    });

    return resolveUserPrincipal({
      kind: "proxy",
      sessionId: "proxy-auth",
      userId,
      profile: {
        name: name || proxyUser,
        email: email || undefined,
        username: proxyUser,
      },
    });
  }

  async function resolve(request: Request): Promise<Principal> {
    const proxyPrincipal = await resolveProxyAuthPrincipal(request);
    if (proxyPrincipal) {
      return proxyPrincipal;
    }

    const payload = await decodeCookie(request);

    const [session] = await opts.db
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, payload.sid))
      .limit(1);

    if (!session) {
      throw new Error("Session not found");
    }

    if (session.expires_at < new Date()) {
      await opts.db.delete(authSessions).where(eq(authSessions.id, session.id));
      throw new Error("Session expired");
    }

    if (session.kind === "api_key") {
      if (!payload.api_key) {
        throw new Error("API key session missing credential");
      }

      return {
        kind: "api_key",
        sessionId: session.id,
        displayName: session.api_key_display ?? "API Key",
        apiKey: payload.api_key,
      };
    }

    if (!session.user_id) {
      throw new Error("OIDC session missing user_id");
    }

    return resolveUserPrincipal({
      kind: "oidc",
      sessionId: session.id,
      idToken: session.oidc_id_token ?? undefined,
      userId: session.user_id,
      profile: {
        name: payload.profile?.name,
        email: payload.profile?.email,
        username: payload.profile?.username,
      },
    });
  }

  function require(request: Request): Promise<Principal> {
    const cached = requestCache.get(request);
    if (cached) {
      return cached;
    }

    const promise = resolve(request);
    requestCache.set(request, promise);
    return promise;
  }

  function can(principal: Principal, capabilities: Capabilities): boolean {
    if (principal.kind === "api_key") {
      return true;
    }

    const roleCaps = Roles[principal.user.role];
    return (capabilities & roleCaps) === capabilities;
  }

  function canManageNode(principal: Principal, node: Machine): boolean {
    if (principal.kind === "api_key") {
      return true;
    }

    const caps = Roles[principal.user.role];
    if ((caps & Capabilities.write_machines) !== 0) {
      return true;
    }

    const hsUserId = principal.user.headscaleUserId;
    return hsUserId !== undefined && node.user?.id === hsUserId;
  }

  function getHeadscaleApiKey(principal: Principal): string {
    if (principal.kind === "api_key") {
      return principal.apiKey;
    }

    if (!opts.headscaleApiKey) {
      throw new Error("User sessions require headscale.api_key to be configured");
    }

    return opts.headscaleApiKey;
  }

  async function createOidcSession(
    userId: string,
    profile: NonNullable<CookiePayload["profile"]>,
    options?: { idToken?: string; maxAge?: number },
  ): Promise<string> {
    const maxAge = options?.maxAge ?? opts.cookie.maxAge;
    const sid = ulid();
    await opts.db.insert(authSessions).values({
      id: sid,
      kind: "oidc",
      user_id: userId,
      oidc_id_token: options?.idToken,
      expires_at: new Date(Date.now() + maxAge * 1000),
    });

    return encodeCookie({ sid, profile }, maxAge);
  }

  async function createApiKeySession(
    apiKey: string,
    displayName: string,
    maxAge: number,
  ): Promise<string> {
    const sid = ulid();
    await opts.db.insert(authSessions).values({
      id: sid,
      kind: "api_key",
      api_key_hash: hashApiKey(apiKey),
      api_key_display: displayName,
      expires_at: new Date(Date.now() + maxAge),
    });

    return encodeCookie({ sid, api_key: apiKey }, Math.floor(maxAge / 1000));
  }

  async function destroySession(request?: Request): Promise<string> {
    if (request) {
      try {
        const payload = await decodeCookie(request);
        await opts.db.delete(authSessions).where(eq(authSessions.id, payload.sid));
      } catch {
        // Cookie already invalid, just clear it
      }
    }

    const cookie = createCookie(opts.cookie.name, {
      ...opts.cookie,
      path: __PREFIX__,
    });

    return cookie.serialize("", { expires: new Date(0) });
  }

  async function findOrCreateUser(
    subject: string,
    profile?: { name?: string; email?: string; picture?: string },
    options?: { initialRole?: string; syncRole?: string },
  ): Promise<string> {
    const [existing] = await opts.db.select().from(users).where(eq(users.sub, subject)).limit(1);

    if (existing) {
      const syncedRole = normalizeInitialRole(options?.syncRole);
      await opts.db
        .update(users)
        .set({
          name: profile?.name,
          email: profile?.email,
          picture: profile?.picture,
          ...(syncedRole && existing.role !== "owner"
            ? { role: syncedRole, caps: capsForRole(syncedRole) }
            : {}),
          last_login_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(users.id, existing.id));
      return existing.id;
    }

    const initialRole = normalizeInitialRole(options?.initialRole) ?? "member";
    const id = ulid();
    await opts.db.insert(users).values({
      id,
      sub: subject,
      name: profile?.name,
      email: profile?.email,
      picture: profile?.picture,
      role: initialRole,
      caps: capsForRole(initialRole),
    });

    const [{ count }] = await opts.db.select({ count: sql<number>`count(*)` }).from(users);

    if (count === 1) {
      await opts.db
        .update(users)
        .set({ role: "owner", caps: capsForRole("owner") })
        .where(eq(users.id, id));
    }

    return id;
  }

  function normalizeInitialRole(role: string | undefined): Exclude<Role, "owner"> | undefined {
    if (role && role !== "owner" && role in Roles) {
      return role as Exclude<Role, "owner">;
    }

    return undefined;
  }

  async function linkHeadscaleUser(userId: string, headscaleUserId: string): Promise<boolean> {
    const [existing] = await opts.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.headscale_user_id, headscaleUserId))
      .limit(1);

    if (existing && existing.id !== userId) {
      return false;
    }

    await opts.db
      .update(users)
      .set({ headscale_user_id: headscaleUserId, updated_at: new Date() })
      .where(eq(users.id, userId));

    return true;
  }

  async function unlinkHeadscaleUser(userId: string): Promise<void> {
    await opts.db
      .update(users)
      .set({ headscale_user_id: null, updated_at: new Date() })
      .where(eq(users.id, userId));
  }

  async function listUsers(): Promise<HeadplaneUser[]> {
    return opts.db.select().from(users);
  }

  async function claimedHeadscaleUserIds(): Promise<Set<string>> {
    const rows = await opts.db.select({ hsId: users.headscale_user_id }).from(users);

    const ids = new Set<string>();
    for (const row of rows) {
      if (row.hsId) {
        ids.add(row.hsId);
      }
    }
    return ids;
  }

  async function roleForSubject(subject: string): Promise<Role | undefined> {
    const [user] = await opts.db.select().from(users).where(eq(users.sub, subject)).limit(1);

    if (!user) {
      return;
    }

    return (user.role in Roles ? user.role : "member") as Role;
  }

  async function roleForHeadscaleUser(headscaleUserId: string): Promise<Role | undefined> {
    const [user] = await opts.db
      .select()
      .from(users)
      .where(eq(users.headscale_user_id, headscaleUserId))
      .limit(1);

    if (!user) {
      return;
    }

    return (user.role in Roles ? user.role : "member") as Role;
  }

  async function transferOwnership(
    currentOwnerUserId: string,
    newOwnerUserId: string,
  ): Promise<boolean> {
    if (currentOwnerUserId === newOwnerUserId) {
      return false;
    }

    const [current] = await opts.db
      .select()
      .from(users)
      .where(eq(users.id, currentOwnerUserId))
      .limit(1);

    if (!current || current.role !== "owner") {
      return false;
    }

    const [target] = await opts.db
      .select()
      .from(users)
      .where(eq(users.id, newOwnerUserId))
      .limit(1);

    if (!target) {
      return false;
    }

    await opts.db
      .update(users)
      .set({ role: "admin", caps: capsForRole("admin"), updated_at: new Date() })
      .where(eq(users.id, current.id));

    await opts.db
      .update(users)
      .set({ role: "owner", caps: capsForRole("owner"), updated_at: new Date() })
      .where(eq(users.id, target.id));

    return true;
  }

  async function reassignUser(userId: string, role: Role): Promise<boolean> {
    const [user] = await opts.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.role === "owner") {
      return false;
    }

    await opts.db
      .update(users)
      .set({ role, caps: capsForRole(role), updated_at: new Date() })
      .where(eq(users.id, userId));

    return true;
  }

  async function pruneExpiredSessions(): Promise<void> {
    await opts.db.delete(authSessions).where(lt(authSessions.expires_at, new Date()));
  }

  function start(): void {
    pruneTimer = setInterval(() => void pruneExpiredSessions(), 15 * 60 * 1000);
  }

  function stop(): void {
    if (pruneTimer) {
      clearInterval(pruneTimer);
      pruneTimer = undefined;
    }
  }

  return {
    registerRequestClientAddress,
    require: require,
    can,
    canManageNode,
    getHeadscaleApiKey,
    createOidcSession,
    createApiKeySession,
    destroySession,
    findOrCreateUser,
    linkHeadscaleUser,
    unlinkHeadscaleUser,
    listUsers,
    claimedHeadscaleUserIds,
    roleForSubject,
    roleForHeadscaleUser,
    transferOwnership,
    reassignUser,
    pruneExpiredSessions,
    start,
    stop,
  };
}
