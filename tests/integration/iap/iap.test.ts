import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { createJwtAuthService } from "~/server/web/jwt-auth";

import { createSigningKey, type JwksEnv, type SigningKey, startJwks } from "./start-jwks";

vi.mock("~/utils/log", () => ({
  default: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

const AUDIENCE = "/projects/123456789/global/backendServices/987654321";
const ISSUER = "https://cloud.google.com/iap";
const HEADER = "x-goog-iap-jwt-assertion";

let jwks: JwksEnv;

beforeAll(async () => {
  jwks = await startJwks();
}, 60_000);

afterAll(async () => {
  await jwks.stop();
});

async function signAssertion(key: SigningKey, subject = "accounts.google.com:1155") {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: "ada@example.com" })
    .setProtectedHeader({ alg: "ES256", kid: key.kid })
    .setSubject(subject)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(key.privateKey);
}

// Note there is no `keyResolver` here: this is the production path, resolving
// keys through `createRemoteJWKSet` against a real HTTP endpoint.
function createService(jwksUrl = jwks.url) {
  return createJwtAuthService({
    provider: "google_iap",
    audience: AUDIENCE,
    jwksUrl,
  });
}

function requestWith(assertion: string): Request {
  return new Request("https://headplane.example.com/machines", {
    headers: { [HEADER]: assertion },
  });
}

describe("assertion verification against a live JWKS endpoint", () => {
  test("authenticate_withPublishedKey_fetchesJwksAndVerifies", async () => {
    const before = jwks.fetchCount();
    const service = createService();

    const result = await service.authenticate(requestWith(await signAssertion(jwks.key)));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.subject).toBe("iap:accounts.google.com:1155");
    // Proof the key really came over the wire rather than from a test double.
    expect(jwks.fetchCount()).toBeGreaterThan(before);
  });

  test("authenticate_distinctAssertions_doesNotRefetchPerRequest", async () => {
    const service = createService();

    // Two different assertions bypass the service's own verification cache, so
    // what is being measured here is the JWKS cache underneath it.
    await service.authenticate(requestWith(await signAssertion(jwks.key, "accounts.google.com:a")));
    const afterFirst = jwks.fetchCount();
    await service.authenticate(requestWith(await signAssertion(jwks.key, "accounts.google.com:b")));

    expect(jwks.fetchCount()).toBe(afterFirst);
  });

  test("authenticate_withKeyNotInJwks_rejects", async () => {
    const service = createService();
    const foreign = await createSigningKey("not-published");

    const result = await service.authenticate(requestWith(await signAssertion(foreign)));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_assertion");
  });

  test("authenticate_withRotatedKeySet_acceptsTheNewKey", async () => {
    // A service with its own cache, so this rotation cannot be satisfied by a
    // key another test already warmed.
    const rotated = await createSigningKey("test-key-2");
    jwks.publish([rotated]);

    try {
      const service = createService();
      const result = await service.authenticate(requestWith(await signAssertion(rotated)));

      expect(result.ok).toBe(true);
    } finally {
      jwks.publish([jwks.key]);
    }
  });
});

describe("JWKS endpoint failures fail closed", () => {
  test("authenticate_whenEndpointUnreachable_rejectsWithoutThrowing", async () => {
    // Port 1 on loopback refuses connections rather than hanging.
    const service = createService("http://127.0.0.1:1/jwks");

    const result = await service.authenticate(requestWith(await signAssertion(jwks.key)));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // A key set that cannot be reached must never authenticate the request.
    expect(result.error.code).toBe("invalid_assertion");
  });

  test("authenticate_whenEndpointReturns404_rejects", async () => {
    const service = createService(jwks.url.replace("/jwks", "/nope"));

    const result = await service.authenticate(requestWith(await signAssertion(jwks.key)));

    expect(result.ok).toBe(false);
  });
});
