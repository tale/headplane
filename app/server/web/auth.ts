import { createHash, createHmac } from "node:crypto";

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
  | {
      kind: "oidc";
      sessionId: string;
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
  db: NodeSQLiteDatabase;
  cookie: {
    name: string;
    secure: boolean;
    maxAge: number;
    domain?: string;
  };
}

export interface AuthService {
  require(request: Request): Promise<Principal>;
  can(principal: Principal, capabilities: Capabilities): boolean;
  canManageNode(principal: Principal, node: Machine): boolean;
  getHeadscaleApiKey(principal: Principal): string;
  createOidcSession(
    userId: string,
    profile: NonNullable<CookiePayload["profile"]>,
    maxAge?: number,
  ): Promise<string>;

  createApiKeySession(apiKey: string, displayName: string, maxAge: number): Promise<string>;
  destroySession(request?: Request): Promise<string>;
  findOrCreateUser(
    subject: string,
    profile?: { name?: string; email?: string; picture?: string },
  ): Promise<string>;

  linkHeadscaleUser(userId: string, headscaleUserId: string): Promise<boolean>;
  unlinkHeadscaleUser(userId: string): Promise<void>;
  linkHeadscaleUserBySubject(subject: string, headscaleUserId: string): Promise<boolean>;
  listUsers(): Promise<HeadplaneUser[]>;
  claimedHeadscaleUserIds(): Promise<Set<string>>;
  roleForSubject(subject: string): Promise<Role | undefined>;
  roleForHeadscaleUser(headscaleUserId: string): Promise<Role | undefined>;
  transferOwnership(currentOwnerSubject: string, newOwnerSubject: string): Promise<boolean>;
  reassignSubject(subject: string, role: Role): Promise<boolean>;
  pruneExpiredSessions(): Promise<void>;
  start(): void;
  stop(): void;
}

export function createAuthService(opts: AuthServiceOptions): AuthService {
  const requestCache = new WeakMap<Request, Promise<Principal>>();
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

  async function resolve(request: Request): Promise<Principal> {
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

    const [user] = await opts.db.select().from(users).where(eq(users.id, session.user_id)).limit(1);

    if (!user) {
      throw new Error("User record not found");
    }

    const role = (user.role in Roles ? user.role : "member") as Role;
    return {
      kind: "oidc",
      sessionId: session.id,
      user: {
        id: user.id,
        subject: user.sub,
        role,
        headscaleUserId: user.headscale_user_id ?? undefined,
      },
      profile: {
        name: payload.profile?.name ?? user.name ?? user.sub,
        email: payload.profile?.email ?? user.email ?? undefined,
        username: payload.profile?.username,
        picture: user.picture ?? undefined,
      },
    };
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
      throw new Error("OIDC sessions require headscale.api_key to be configured");
    }

    return opts.headscaleApiKey;
  }

  async function createOidcSession(
    userId: string,
    profile: NonNullable<CookiePayload["profile"]>,
    maxAge = opts.cookie.maxAge,
  ): Promise<string> {
    const sid = ulid();
    await opts.db.insert(authSessions).values({
      id: sid,
      kind: "oidc",
      user_id: userId,
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
  ): Promise<string> {
    const [existing] = await opts.db.select().from(users).where(eq(users.sub, subject)).limit(1);

    if (existing) {
      await opts.db
        .update(users)
        .set({
          name: profile?.name,
          email: profile?.email,
          picture: profile?.picture,
          last_login_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(users.id, existing.id));
      return existing.id;
    }

    const id = ulid();
    await opts.db.insert(users).values({
      id,
      sub: subject,
      name: profile?.name,
      email: profile?.email,
      picture: profile?.picture,
      role: "member",
      caps: capsForRole("member"),
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

  async function linkHeadscaleUserBySubject(
    subject: string,
    headscaleUserId: string,
  ): Promise<boolean> {
    const [user] = await opts.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.sub, subject))
      .limit(1);

    if (!user) {
      return false;
    }

    return linkHeadscaleUser(user.id, headscaleUserId);
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
    currentOwnerSubject: string,
    newOwnerSubject: string,
  ): Promise<boolean> {
    const [current] = await opts.db
      .select()
      .from(users)
      .where(eq(users.sub, currentOwnerSubject))
      .limit(1);

    if (!current || current.role !== "owner") {
      return false;
    }

    const [target] = await opts.db
      .select()
      .from(users)
      .where(eq(users.sub, newOwnerSubject))
      .limit(1);

    if (!target || target.id === current.id) {
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

  async function reassignSubject(subject: string, role: Role): Promise<boolean> {
    const currentRole = await roleForSubject(subject);
    if (currentRole === "owner") {
      return false;
    }

    await opts.db
      .insert(users)
      .values({
        id: ulid(),
        sub: subject,
        role,
        caps: capsForRole(role),
      })
      .onConflictDoUpdate({
        target: users.sub,
        set: { role, caps: capsForRole(role), updated_at: new Date() },
      });

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
    linkHeadscaleUserBySubject,
    listUsers,
    claimedHeadscaleUserIds,
    roleForSubject,
    roleForHeadscaleUser,
    transferOwnership,
    reassignSubject,
    pruneExpiredSessions,
    start,
    stop,
  };
}
