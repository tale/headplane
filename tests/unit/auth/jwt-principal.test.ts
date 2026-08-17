import { SignJWT, generateKeyPair } from "jose";
import type { JWTVerifyGetKey } from "jose";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { type AuthService, isUserPrincipal } from "~/server/web/auth";
import { createJwtAuthService } from "~/server/web/jwt-auth";
import { Capabilities } from "~/server/web/roles";

import { createTestAuth } from "./create-auth";

vi.mock("~/utils/log", () => ({
  default: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

const AUDIENCE = "/projects/123456789/global/backendServices/987654321";
const ISSUER = "https://cloud.google.com/iap";
const HEADER = "x-goog-iap-jwt-assertion";

let privateKey: CryptoKey;
let publicKey: CryptoKey;
let foreignKey: CryptoKey;

beforeAll(async () => {
  const keys = await generateKeyPair("ES256");
  privateKey = keys.privateKey;
  publicKey = keys.publicKey;
  foreignKey = (await generateKeyPair("ES256")).privateKey;
});

async function signAssertion(
  options: { subject?: string; email?: string; key?: CryptoKey } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: options.email ?? "ada@example.com" })
    .setProtectedHeader({ alg: "ES256" })
    .setSubject(options.subject ?? "accounts.google.com:1155")
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(options.key ?? privateKey);
}

function buildAuth(options: { defaultRole?: string; headscaleApiKey?: string | null } = {}) {
  const service = createJwtAuthService({
    provider: "google_iap",
    audience: AUDIENCE,
    keyResolver: (() => Promise.resolve(publicKey)) as unknown as JWTVerifyGetKey,
  });

  return createTestAuth({
    headscaleApiKey: options.headscaleApiKey === null ? undefined : "hs-api-key",
    jwtAuth: { service, defaultRole: options.defaultRole },
  });
}

function requestWith(assertion?: string, cookie?: string): Request {
  const headers = new Headers();
  if (assertion) {
    headers.set(HEADER, assertion);
  }
  if (cookie) {
    headers.set("cookie", cookie);
  }

  return new Request("https://headplane.example.com/machines", { headers });
}

describe("JWT-authenticated principals", () => {
  let auth: AuthService;

  beforeEach(() => {
    ({ auth } = buildAuth());
  });

  test("require_withValidAssertion_returnsJwtPrincipal", async () => {
    const principal = await auth.require(requestWith(await signAssertion()));

    expect(principal.kind).toBe("jwt");
    if (principal.kind === "api_key") return;

    expect(principal.user.subject).toBe("iap:accounts.google.com:1155");
    expect(principal.profile.email).toBe("ada@example.com");
    expect(principal.sessionId).toBe("jwt-auth");
  });

  test("require_withValidAssertion_createsNoSessionRow", async () => {
    const { auth: service, db } = buildAuth();
    await service.require(requestWith(await signAssertion()));

    // The proxy owns the session; Headplane keeps no server-side state for it.
    const { authSessions } = await import("~/server/db/schema");
    const sessions = await db.select().from(authSessions);
    expect(sessions).toHaveLength(0);
  });

  test("firstJwtUser_becomesOwner", async () => {
    const principal = await auth.require(requestWith(await signAssertion()));
    if (principal.kind === "api_key") return;

    expect(principal.user.role).toBe("owner");
  });

  test("subsequentJwtUser_receivesConfiguredDefaultRole", async () => {
    const { auth: service } = buildAuth({ defaultRole: "auditor" });

    await service.require(requestWith(await signAssertion({ subject: "accounts.google.com:1" })));
    const second = await service.require(
      requestWith(
        await signAssertion({ subject: "accounts.google.com:2", email: "b@example.com" }),
      ),
    );

    if (second.kind === "api_key") return;
    expect(second.user.role).toBe("auditor");
  });
});

describe("JWT principals participate in authorization", () => {
  // Regression guard: `isUserPrincipal` and the capability checks enumerate
  // principal kinds explicitly. A new kind that is missing from them still
  // compiles and still authenticates, but silently stops being treated as a
  // user — an authorization failure with no error anywhere.

  test("isUserPrincipal_forJwtPrincipal_returnsTrue", async () => {
    const { auth } = buildAuth();
    const principal = await auth.require(requestWith(await signAssertion()));

    expect(isUserPrincipal(principal)).toBe(true);
  });

  test("can_forJwtOwner_grantsOwnerCapabilities", async () => {
    const { auth } = buildAuth();
    const principal = await auth.require(requestWith(await signAssertion()));

    expect(auth.can(principal, Capabilities.write_machines)).toBe(true);
  });

  test("can_forJwtMember_deniesPrivilegedCapabilities", async () => {
    const { auth } = buildAuth({ defaultRole: "viewer" });

    await auth.require(requestWith(await signAssertion({ subject: "accounts.google.com:owner" })));
    const viewer = await auth.require(
      requestWith(
        await signAssertion({ subject: "accounts.google.com:viewer", email: "v@example.com" }),
      ),
    );

    expect(auth.can(viewer, Capabilities.write_machines)).toBe(false);
  });
});

describe("JWT authentication fails closed", () => {
  test("require_withInvalidAssertion_rejectsInsteadOfFallingThrough", async () => {
    const { auth } = buildAuth();

    // Establish a legitimate cookie session, then present it alongside an
    // assertion signed by the wrong key. If the bad assertion silently fell
    // through, the cookie would authenticate the request — a downgrade attack.
    const userId = await auth.findOrCreateUser("sub-cookie", { name: "Cookie" });
    const cookie = await auth.createOidcSession(userId, { name: "Cookie" });
    const forged = await signAssertion({ key: foreignKey });

    await expect(auth.require(requestWith(forged, cookie))).rejects.toThrow(
      /JWT authentication failed/,
    );
  });

  test("require_withoutAssertion_fallsThroughToCookieSession", async () => {
    const { auth } = buildAuth();

    const userId = await auth.findOrCreateUser("sub-cookie", { name: "Cookie" });
    const cookie = await auth.createOidcSession(userId, { name: "Cookie" });

    const principal = await auth.require(requestWith(undefined, cookie));
    expect(principal.kind).toBe("oidc");
  });

  test("require_withoutHeadscaleApiKey_rejects", async () => {
    const { auth } = buildAuth({ headscaleApiKey: null });

    await expect(auth.require(requestWith(await signAssertion()))).rejects.toThrow(
      /requires headscale.api_key/,
    );
  });
});
