import { SignJWT, generateKeyPair } from "jose";
import type { JWTVerifyGetKey } from "jose";
import { beforeAll, describe, expect, test, vi } from "vitest";

import { createJwtAuthService, type JwtAuthConfig } from "~/server/web/jwt-auth";

vi.mock("~/utils/log", () => ({
  default: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

const AUDIENCE = "/projects/123456789/global/backendServices/987654321";
const ISSUER = "https://cloud.google.com/iap";
const HEADER = "x-goog-iap-jwt-assertion";
const SUBJECT = "accounts.google.com:115538452175435729857";

let esPrivateKey: CryptoKey;
let esPublicKey: CryptoKey;
let otherEsPrivateKey: CryptoKey;
let rsaPrivateKey: CryptoKey;
let rsaPublicKey: CryptoKey;

beforeAll(async () => {
  const es = await generateKeyPair("ES256");
  esPrivateKey = es.privateKey;
  esPublicKey = es.publicKey;

  const otherEs = await generateKeyPair("ES256");
  otherEsPrivateKey = otherEs.privateKey;

  const rsa = await generateKeyPair("RS256");
  rsaPrivateKey = rsa.privateKey;
  rsaPublicKey = rsa.publicKey;
});

function resolverFor(key: CryptoKey): JWTVerifyGetKey {
  return (() => Promise.resolve(key)) as unknown as JWTVerifyGetKey;
}

interface AssertionOptions {
  audience?: string;
  issuer?: string;
  subject?: string | null;
  email?: string | null;
  hd?: string;
  expiresIn?: number;
  notBefore?: number;
  alg?: string;
  key?: CryptoKey;
}

async function signAssertion(options: AssertionOptions = {}): Promise<string> {
  const claims: Record<string, unknown> = {};
  if (options.email !== null) {
    claims.email = options.email ?? "ada@example.com";
  }
  if (options.hd) {
    claims.hd = options.hd;
  }

  const now = Math.floor(Date.now() / 1000);
  let jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: options.alg ?? "ES256" })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + (options.expiresIn ?? 600));

  if (options.subject !== null) {
    jwt = jwt.setSubject(options.subject ?? SUBJECT);
  }

  if (options.notBefore !== undefined) {
    jwt = jwt.setNotBefore(now + options.notBefore);
  }

  return jwt.sign(options.key ?? esPrivateKey);
}

function requestWith(assertion?: string, headerName = HEADER): Request {
  const headers = new Headers();
  if (assertion !== undefined) {
    headers.set(headerName, assertion);
  }

  return new Request("https://headplane.example.com/machines", { headers });
}

function createService(overrides: Partial<JwtAuthConfig> = {}) {
  return createJwtAuthService({
    provider: "google_iap",
    audience: AUDIENCE,
    keyResolver: resolverFor(esPublicKey),
    ...overrides,
  });
}

describe("createJwtAuthService configuration", () => {
  test("createJwtAuthService_withoutAudience_throwsAtConstruction", () => {
    expect(() => createService({ audience: "" })).toThrow(/audience is required/);
  });

  test("createJwtAuthService_withBlankAudience_throwsAtConstruction", () => {
    expect(() => createService({ audience: "   " })).toThrow(/audience is required/);
  });

  test("createJwtAuthService_withGoogleIapPreset_exposesHeaderAndLogoutUrl", () => {
    const service = createService();
    expect(service.header).toBe(HEADER);
    expect(service.logoutUrl).toBe("/?gcp-iap-mode=CLEAR_LOGIN_COOKIE");
  });
});

describe("authenticate happy path", () => {
  test("authenticate_withValidAssertion_returnsNamespacedIdentity", async () => {
    const service = createService();
    const result = await service.authenticate(requestWith(await signAssertion()));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.subject).toBe(`iap:${SUBJECT}`);
    expect(result.value.email).toBe("ada@example.com");
    expect(result.value.name).toBe("ada");
    expect(result.value.expiresAt).toBeGreaterThan(Date.now());
  });

  test("authenticate_headerLookupIsCaseInsensitive_returnsIdentity", async () => {
    const service = createService();
    const assertion = await signAssertion();
    const result = await service.authenticate(requestWith(assertion, "X-Goog-IAP-JWT-Assertion"));

    expect(result.ok).toBe(true);
  });

  test("authenticate_withoutEmailClaim_fallsBackToSubjectForName", async () => {
    const service = createService();
    const result = await service.authenticate(requestWith(await signAssertion({ email: null })));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.email).toBeUndefined();
    expect(result.value.name).toBe(SUBJECT);
  });
});

describe("authenticate rejects unverifiable assertions", () => {
  test("authenticate_withoutHeader_returnsMissingAssertion", async () => {
    const service = createService();
    const result = await service.authenticate(requestWith());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The caller relies on this code to distinguish "fall through to the
    // cookie session" from "fail closed".
    expect(result.error.code).toBe("missing_assertion");
  });

  test("authenticate_withEmptyHeader_returnsMissingAssertion", async () => {
    const service = createService();
    const result = await service.authenticate(requestWith("   "));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("missing_assertion");
  });

  test("authenticate_withWrongAudience_reportsMismatchAndActualAudience", async () => {
    const service = createService();
    const assertion = await signAssertion({
      audience: "/projects/999/global/backendServices/111",
    });
    const result = await service.authenticate(requestWith(assertion));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("audience_mismatch");
    // Diagnosing an audience mismatch is impossible without both values.
    expect(result.error.message).toContain(AUDIENCE);
    expect(result.error.message).toContain("/projects/999/global/backendServices/111");
  });

  test("authenticate_withWrongIssuer_returnsIssuerMismatch", async () => {
    const service = createService();
    const assertion = await signAssertion({ issuer: "https://evil.example.com" });
    const result = await service.authenticate(requestWith(assertion));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("issuer_mismatch");
  });

  test("authenticate_withExpiredAssertion_returnsExpired", async () => {
    const service = createService();
    const assertion = await signAssertion({ expiresIn: -600 });
    const result = await service.authenticate(requestWith(assertion));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("expired_assertion");
  });

  test("authenticate_withFutureNotBefore_returnsInvalid", async () => {
    const service = createService();
    const assertion = await signAssertion({ notBefore: 600 });
    const result = await service.authenticate(requestWith(assertion));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_assertion");
  });

  test("authenticate_withForeignSignature_returnsInvalid", async () => {
    const service = createService();
    const assertion = await signAssertion({ key: otherEsPrivateKey });
    const result = await service.authenticate(requestWith(assertion));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_assertion");
  });

  test("authenticate_withMissingSubject_returnsMissingSubject", async () => {
    const service = createService();
    const assertion = await signAssertion({ subject: null });
    const result = await service.authenticate(requestWith(assertion));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("missing_subject");
  });

  test("authenticate_withGarbageHeader_returnsInvalid", async () => {
    const service = createService();
    const result = await service.authenticate(requestWith("not-a-jwt"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_assertion");
  });
});

describe("authenticate resists algorithm substitution", () => {
  test("authenticate_withRs256SignedAssertion_rejectsEvenWhenKeyMatches", async () => {
    // The resolver hands back the *correct* RSA key, so only the algorithm
    // allowlist can reject this. If it passes, alg confusion is possible.
    const service = createService({ keyResolver: resolverFor(rsaPublicKey) });
    const assertion = await signAssertion({ alg: "RS256", key: rsaPrivateKey });
    const result = await service.authenticate(requestWith(assertion));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_assertion");
  });

  test("authenticate_withAlgNoneAssertion_rejects", async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${encode({ alg: "none", typ: "JWT" })}.${encode({
      sub: SUBJECT,
      email: "ada@example.com",
      iss: ISSUER,
      aud: AUDIENCE,
      iat: now,
      exp: now + 600,
    })}.`;

    const service = createService();
    const result = await service.authenticate(requestWith(unsigned));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_assertion");
  });
});

describe("hosted domain allowlist", () => {
  test("authenticate_withHdOutsideAllowlist_returnsDomainNotAllowed", async () => {
    const service = createService({ allowedDomains: ["example.com"] });
    const assertion = await signAssertion({
      hd: "attacker.com",
      email: "ada@attacker.com",
    });
    const result = await service.authenticate(requestWith(assertion));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("domain_not_allowed");
  });

  test("authenticate_withHdInAllowlist_returnsIdentity", async () => {
    const service = createService({ allowedDomains: ["example.com"] });
    const assertion = await signAssertion({ hd: "example.com" });
    const result = await service.authenticate(requestWith(assertion));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.domain).toBe("example.com");
  });

  test("authenticate_consumerAccountWithoutHd_fallsBackToEmailDomain", async () => {
    // Consumer Google accounts carry no `hd`. Without the email fallback an
    // allowlist of ["example.com"] would silently admit any gmail.com user.
    const service = createService({ allowedDomains: ["example.com"] });
    const assertion = await signAssertion({ email: "someone@gmail.com" });
    const result = await service.authenticate(requestWith(assertion));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("domain_not_allowed");
  });

  test("authenticate_withoutEmailOrHdAndAllowlistSet_returnsDomainNotAllowed", async () => {
    const service = createService({ allowedDomains: ["example.com"] });
    const assertion = await signAssertion({ email: null });
    const result = await service.authenticate(requestWith(assertion));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("domain_not_allowed");
  });

  test("authenticate_allowlistMatchIsCaseInsensitive_returnsIdentity", async () => {
    const service = createService({ allowedDomains: ["  Example.COM  "] });
    const assertion = await signAssertion({ hd: "EXAMPLE.com" });
    const result = await service.authenticate(requestWith(assertion));

    expect(result.ok).toBe(true);
  });
});

describe("verification cache", () => {
  test("authenticate_repeatedAssertion_verifiesSignatureOnce", async () => {
    const resolver = vi.fn(() => Promise.resolve(esPublicKey)) as unknown as JWTVerifyGetKey;
    const service = createService({ keyResolver: resolver });
    const assertion = await signAssertion();
    const request = requestWith(assertion);

    await service.authenticate(request);
    await service.authenticate(request);
    await service.authenticate(request);

    expect(resolver).toHaveBeenCalledTimes(1);
  });

  test("authenticate_distinctAssertions_verifiesEach", async () => {
    const resolver = vi.fn(() => Promise.resolve(esPublicKey)) as unknown as JWTVerifyGetKey;
    const service = createService({ keyResolver: resolver });

    await service.authenticate(requestWith(await signAssertion({ email: "a@example.com" })));
    await service.authenticate(requestWith(await signAssertion({ email: "b@example.com" })));

    expect(resolver).toHaveBeenCalledTimes(2);
  });

  test("authenticate_failedAssertion_isNotCached", async () => {
    const resolver = vi.fn(() => Promise.resolve(esPublicKey)) as unknown as JWTVerifyGetKey;
    const service = createService({ keyResolver: resolver });
    const assertion = await signAssertion({ issuer: "https://evil.example.com" });

    await service.authenticate(requestWith(assertion));
    await service.authenticate(requestWith(assertion));

    expect(resolver).toHaveBeenCalledTimes(2);
  });

  test("authenticate_cacheIsBounded_evictsOldestEntries", async () => {
    const resolver = vi.fn(() => Promise.resolve(esPublicKey)) as unknown as JWTVerifyGetKey;
    const service = createService({ keyResolver: resolver, cacheMaxEntries: 2 });

    const first = await signAssertion({ email: "a@example.com" });
    const second = await signAssertion({ email: "b@example.com" });
    const third = await signAssertion({ email: "c@example.com" });

    await service.authenticate(requestWith(first));
    await service.authenticate(requestWith(second));
    await service.authenticate(requestWith(third));
    expect(resolver).toHaveBeenCalledTimes(3);

    // `first` was evicted when `third` pushed the cache past its bound.
    await service.authenticate(requestWith(first));
    expect(resolver).toHaveBeenCalledTimes(4);
  });

  test("authenticate_cacheNeverOutlivesAssertionExpiry", async () => {
    const resolver = vi.fn(() => Promise.resolve(esPublicKey)) as unknown as JWTVerifyGetKey;
    // A long cache TTL must still be clamped by the assertion's own `exp`.
    const service = createService({ keyResolver: resolver, cacheTtlMs: 600_000 });
    const assertion = await signAssertion({ expiresIn: 3 });
    const request = requestWith(assertion);

    await service.authenticate(request);
    expect(resolver).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    try {
      // Past `exp` *and* past the default clock tolerance.
      vi.setSystemTime(Date.now() + 20_000);
      const result = await service.authenticate(request);

      // Re-verified rather than served from cache, and now genuinely expired.
      expect(resolver).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
