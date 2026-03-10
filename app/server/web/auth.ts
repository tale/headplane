import { createHash, createHmac } from "node:crypto";

import { eq, lt, sql } from "drizzle-orm";
import { LibSQLDatabase } from "drizzle-orm/libsql/driver";
import { createCookie } from "react-router";
import { ulid } from "ulidx";

import type { Machine } from "~/types";

import { authSessions, users } from "../db/schema";
import { Capabilities, type Role, Roles, capsForRole } from "./roles";

// ── Principal ────────────────────────────────────────────────────────
// The per-request identity object. Discriminated on `kind` so routes
// can branch structurally instead of checking magic strings.

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
        onboarded: boolean;
      };
      profile: {
        name: string;
        email?: string;
        username?: string;
        picture?: string;
      };
    };

// ── Cookie payload ───────────────────────────────────────────────────
// The cookie contains only a session ID + minimal profile data for
// SSR rendering. Credentials never leave the server.

interface CookiePayload {
  sid: string;
  // API key is stored in the cookie ONLY for api_key sessions.
  // OIDC sessions use the server-side oidc.headscale_api_key.
  api_key?: string;
  profile?: {
    name: string;
    email?: string;
    username?: string;
    picture?: string;
  };
}

// ── AuthService ──────────────────────────────────────────────────────

export interface AuthServiceOptions {
  secret: string;
  db: LibSQLDatabase;
  cookie: {
    name: string;
    secure: boolean;
    maxAge: number;
    domain?: string;
  };
}

export class AuthService {
  private opts: AuthServiceOptions;
  private requestCache = new WeakMap<Request, Promise<Principal>>();

  constructor(opts: AuthServiceOptions) {
    this.opts = opts;
  }

  // ── Authentication ─────────────────────────────────────────────

  /**
   * Resolve the principal for a request. Throws if no valid session.
   * Results are cached per-request so multiple calls in the same
   * loader don't hit the DB repeatedly.
   */
  require(request: Request): Promise<Principal> {
    const cached = this.requestCache.get(request);
    if (cached) {
      return cached;
    }

    const promise = this.resolve(request);
    this.requestCache.set(request, promise);
    return promise;
  }

  private async resolve(request: Request): Promise<Principal> {
    const payload = await this.decodeCookie(request);

    const [session] = await this.opts.db
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, payload.sid))
      .limit(1);

    if (!session) {
      throw new Error("Session not found");
    }

    if (session.expires_at < new Date()) {
      await this.opts.db.delete(authSessions).where(eq(authSessions.id, session.id));
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

    const [user] = await this.opts.db
      .select()
      .from(users)
      .where(eq(users.id, session.user_id))
      .limit(1);

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
        onboarded: user.onboarded,
      },
      profile: payload.profile ?? {
        name: user.sub,
      },
    };
  }

  // ── Authorization ──────────────────────────────────────────────

  /**
   * Check if a principal has a given set of capabilities.
   * API key principals always have full access.
   */
  can(principal: Principal, capabilities: Capabilities): boolean {
    if (principal.kind === "api_key") {
      return true;
    }

    const roleCaps = Roles[principal.user.role];
    return (capabilities & roleCaps) === capabilities;
  }

  /**
   * Check if a principal can act on a machine. Owners of the machine
   * can act on it even without write_machines capability.
   */
  canManageNode(principal: Principal, node: Machine): boolean {
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

  // ── Session management ─────────────────────────────────────────

  /**
   * Create a new OIDC session. Returns the Set-Cookie header value.
   */
  async createOidcSession(
    userId: string,
    profile: NonNullable<CookiePayload["profile"]>,
    maxAge = this.opts.cookie.maxAge,
  ): Promise<string> {
    const sid = ulid();
    await this.opts.db.insert(authSessions).values({
      id: sid,
      kind: "oidc",
      user_id: userId,
      expires_at: new Date(Date.now() + maxAge * 1000),
    });

    return this.encodeCookie({ sid, profile }, maxAge);
  }

  /**
   * Create a new API key session. A SHA-256 hash of the key is stored
   * server-side for auditing. The plaintext key is carried in the
   * HMAC-signed cookie so it can be used for Headscale API calls.
   * Returns the Set-Cookie header value.
   */
  async createApiKeySession(apiKey: string, displayName: string, maxAge: number): Promise<string> {
    const sid = ulid();
    await this.opts.db.insert(authSessions).values({
      id: sid,
      kind: "api_key",
      api_key_hash: this.hashApiKey(apiKey),
      api_key_display: displayName,
      expires_at: new Date(Date.now() + maxAge),
    });

    return this.encodeCookie({ sid, api_key: apiKey }, Math.floor(maxAge / 1000));
  }

  /**
   * Get the Headscale API key for making API calls.
   * OIDC sessions use the configured oidc.headscale_api_key.
   * API key sessions use the user-provided key stored in the cookie.
   * TODO: Get rid of this AI garbage
   */
  getHeadscaleApiKey(principal: Principal, oidcApiKey?: string): string {
    if (principal.kind === "api_key") {
      return principal.apiKey;
    }

    if (!oidcApiKey) {
      throw new Error("OIDC sessions require oidc.headscale_api_key");
    }

    return oidcApiKey;
  }

  /**
   * Destroy the current session. Returns the Set-Cookie header that
   * clears the cookie.
   */
  async destroySession(request?: Request): Promise<string> {
    if (request) {
      try {
        const payload = await this.decodeCookie(request);
        await this.opts.db.delete(authSessions).where(eq(authSessions.id, payload.sid));
      } catch {
        // Cookie already invalid, just clear it
      }
    }

    const cookie = createCookie(this.opts.cookie.name, {
      ...this.opts.cookie,
      path: __PREFIX__,
    });

    return cookie.serialize("", { expires: new Date(0) });
  }

  // ── User management ────────────────────────────────────────────

  /**
   * Find or create a Headplane user by OIDC subject. Returns the
   * user ID. The first user ever created is automatically granted
   * the owner role (bootstrap). Uses upsert to avoid race conditions.
   */
  async findOrCreateUser(subject: string): Promise<string> {
    const [existing] = await this.opts.db
      .select()
      .from(users)
      .where(eq(users.sub, subject))
      .limit(1);

    if (existing) {
      await this.opts.db
        .update(users)
        .set({ last_login_at: new Date(), updated_at: new Date() })
        .where(eq(users.id, existing.id));
      return existing.id;
    }

    const id = ulid();
    await this.opts.db.insert(users).values({
      id,
      sub: subject,
      role: "member",
      caps: capsForRole("member"),
      onboarded: false,
    });

    // If this is the only user in the table, promote to owner.
    // The unique constraint on `sub` prevents two concurrent inserts
    // for the same subject; for different subjects, COUNT atomically
    // reflects all committed rows so at most one will see count === 1.
    const [{ count }] = await this.opts.db.select({ count: sql<number>`count(*)` }).from(users);

    if (count === 1) {
      await this.opts.db
        .update(users)
        .set({ role: "owner", caps: capsForRole("owner") })
        .where(eq(users.id, id));
    }

    return id;
  }

  /**
   * Link a Headplane user to a Headscale user. Returns false if the
   * Headscale user is already claimed by another Headplane user.
   */
  async linkHeadscaleUser(userId: string, headscaleUserId: string): Promise<boolean> {
    const [existing] = await this.opts.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.headscale_user_id, headscaleUserId))
      .limit(1);

    if (existing && existing.id !== userId) {
      return false;
    }

    await this.opts.db
      .update(users)
      .set({ headscale_user_id: headscaleUserId, updated_at: new Date() })
      .where(eq(users.id, userId));

    return true;
  }

  /**
   * Link a Headplane user (identified by OIDC subject) to a Headscale
   * user. Used by admin UI when subjects are more accessible than
   * internal Headplane IDs. Returns false if already claimed.
   */
  async linkHeadscaleUserBySubject(subject: string, headscaleUserId: string): Promise<boolean> {
    const [user] = await this.opts.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.sub, subject))
      .limit(1);

    if (!user) {
      return false;
    }

    return this.linkHeadscaleUser(user.id, headscaleUserId);
  }

  /**
   * Returns the set of Headscale user IDs that are already claimed
   * by a Headplane user. Used to filter the onboarding dropdown.
   */
  async claimedHeadscaleUserIds(): Promise<Set<string>> {
    const rows = await this.opts.db.select({ hsId: users.headscale_user_id }).from(users);

    const ids = new Set<string>();
    for (const row of rows) {
      if (row.hsId) {
        ids.add(row.hsId);
      }
    }
    return ids;
  }

  /**
   * Get the role for a given OIDC subject. Used by the users overview
   * to display roles for Headscale users.
   */
  async roleForSubject(subject: string): Promise<Role | undefined> {
    const [user] = await this.opts.db.select().from(users).where(eq(users.sub, subject)).limit(1);

    if (!user) {
      return;
    }

    return (user.role in Roles ? user.role : "member") as Role;
  }

  /**
   * Reassign the role of a user identified by their OIDC subject.
   * Cannot reassign the owner role.
   */
  async reassignSubject(subject: string, role: Role): Promise<boolean> {
    const currentRole = await this.roleForSubject(subject);
    if (currentRole === "owner") {
      return false;
    }

    await this.opts.db
      .insert(users)
      .values({
        id: ulid(),
        sub: subject,
        role,
        caps: capsForRole(role),
        onboarded: false,
      })
      .onConflictDoUpdate({
        target: users.sub,
        set: { role, caps: capsForRole(role), updated_at: new Date() },
      });

    return true;
  }

  /**
   * Clean up expired sessions. Should be called periodically.
   */
  async pruneExpiredSessions(): Promise<void> {
    await this.opts.db.delete(authSessions).where(lt(authSessions.expires_at, new Date()));
  }

  // ── Private helpers ────────────────────────────────────────────

  private async encodeCookie(payload: CookiePayload, maxAge: number): Promise<string> {
    const cookie = createCookie(this.opts.cookie.name, {
      ...this.opts.cookie,
      path: __PREFIX__,
      maxAge,
    });

    const signed = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const hmac = createHmac("sha256", this.opts.secret).update(signed).digest("base64url");

    return cookie.serialize(`${signed}.${hmac}`);
  }

  private async decodeCookie(request: Request): Promise<CookiePayload> {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) {
      throw new Error("No session cookie found");
    }

    const cookie = createCookie(this.opts.cookie.name, {
      ...this.opts.cookie,
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

    const expected = createHmac("sha256", this.opts.secret).update(signed).digest("base64url");

    if (hmac !== expected) {
      throw new Error("Invalid session cookie signature");
    }

    return JSON.parse(Buffer.from(signed, "base64url").toString("utf-8")) as CookiePayload;
  }

  private hashApiKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }
}

export function createAuthService(opts: AuthServiceOptions): AuthService {
  return new AuthService(opts);
}
