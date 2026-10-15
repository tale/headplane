import { SignJWT, generateKeyPair } from "jose";
import type { JWTVerifyGetKey } from "jose";
import { beforeAll, describe, expect, test } from "vitest";

import { createJwtAuthService, type JwtAuthConfig } from "~/server/web/jwt-auth";

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

  otherEsPrivateKey = (await generateKeyPair("ES256")).privateKey;

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
  expiresIn?: number | null;
  notBefore?: number;
  alg?: string;
  key?: CryptoKey;
}

async function signAssertion(options: AssertionOptions = {}): Promise<string> {
  const claims: Record<string, unknown> = {};
  if (options.email !== null) {
    claims.email = options.email ?? "ada@example.com";
  }

  const now = Math.floor(Date.now() / 1000);
  let jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: options.alg ?? "ES256" })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setIssuedAt(now);

  if (options.expiresIn !== null) {
    jwt = jwt.setExpirationTime(now + (options.expiresIn ?? 600));
  }

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
    header: HEADER,
    issuer: ISSUER,
    jwksEndpoint: "https://www.gstatic.com/iap/verify/public_key-jwk",
    audience: AUDIENCE,
    keyResolver: resolverFor(esPublicKey),
    ...overrides,
  });
}

describe("createJwtAuthService configuration", () => {
  test.each(["header", "issuer", "jwksEndpoint", "audience"] as const)(
    "createJwtAuthService_withBlank_%s_throwsAtConstruction",
    (field) => {
      expect(() => createService({ [field]: "  " })).toThrow(/is required/);
    },
  );

  test.each(["HS256", "HS384", "HS512"])(
    "createJwtAuthService_with%sInAlgorithms_throwsAtConstruction",
    (alg) => {
      expect(() => createService({ algorithms: ["ES256", alg] })).toThrow(/cannot include/);
    },
  );

  test("createJwtAuthService_exposesTheConfiguredHeaderAndLogoutUrl", () => {
    const service = createService({ logoutUrl: "/?gcp-iap-mode=CLEAR_LOGIN_COOKIE" });

    expect(service.header).toBe(HEADER);
    expect(service.logoutUrl).toBe("/?gcp-iap-mode=CLEAR_LOGIN_COOKIE");
  });

  test("createJwtAuthService_withoutAlgorithms_acceptsAsymmetricSignatures", async () => {
    const service = createService({ algorithms: undefined });
    const result = await service.authenticate(requestWith(await signAssertion()));

    expect(result.ok).toBe(true);
  });
});

describe("authenticate identity", () => {
  test("authenticate_withValidAssertion_returnsIssuerScopedSubject", async () => {
    const service = createService();
    const result = await service.authenticate(requestWith(await signAssertion()));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.subject).toBe(`jwt:${ISSUER}:${SUBJECT}`);
    expect(result.value.email).toBe("ada@example.com");
    expect(result.value.name).toBe("ada");
  });

  test("authenticate_sameSubjectFromAnotherIssuer_yieldsDifferentIdentity", async () => {
    const other = "https://other.example.com";
    const first = await createService().authenticate(requestWith(await signAssertion()));
    const second = await createService({ issuer: other }).authenticate(
      requestWith(await signAssertion({ issuer: other })),
    );

    if (!first.ok || !second.ok) throw new Error("expected both assertions to verify");
    expect(first.value.subject).not.toBe(second.value.subject);
  });

  test("authenticate_withWhitespaceInSubject_keepsItExactly", async () => {
    const service = createService();
    const result = await service.authenticate(
      requestWith(await signAssertion({ subject: " 42 " })),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subject).toBe(`jwt:${ISSUER}: 42 `);
  });

  test("authenticate_withoutEmailClaim_fallsBackToSubjectForName", async () => {
    const service = createService();
    const result = await service.authenticate(requestWith(await signAssertion({ email: null })));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.email).toBeUndefined();
    expect(result.value.name).toBe(SUBJECT);
  });

  test("authenticate_headerLookupIsCaseInsensitive_returnsIdentity", async () => {
    const service = createService({ header: "X-Custom-Assertion" });
    const result = await service.authenticate(
      requestWith(await signAssertion(), "x-custom-assertion"),
    );

    expect(result.ok).toBe(true);
  });
});

describe("authenticate rejects unverifiable assertions", () => {
  async function expectRejection(
    assertion: string | undefined,
    code: string,
    overrides: Partial<JwtAuthConfig> = {},
  ) {
    const result = await createService(overrides).authenticate(requestWith(assertion));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(code);
    return result.error;
  }

  test("authenticate_withoutHeader_returnsMissingAssertion", async () => {
    await expectRejection(undefined, "missing_assertion");
  });

  test("authenticate_withEmptyHeader_returnsInvalidAssertion", async () => {
    await expectRejection("", "invalid_assertion");
    await expectRejection("   ", "invalid_assertion");
  });

  test("authenticate_withGarbageHeader_returnsInvalid", async () => {
    await expectRejection("not-a-jwt", "invalid_assertion");
  });

  test("authenticate_withWrongAudience_reportsBothAudiences", async () => {
    const wrong = "/projects/999/global/backendServices/111";
    const error = await expectRejection(
      await signAssertion({ audience: wrong }),
      "audience_mismatch",
    );

    expect(error?.message).toContain(AUDIENCE);
    expect(error?.message).toContain(wrong);
  });

  test("authenticate_withWrongIssuer_returnsIssuerMismatch", async () => {
    await expectRejection(
      await signAssertion({ issuer: "https://evil.example.com" }),
      "issuer_mismatch",
    );
  });

  test("authenticate_withoutExpiry_rejects", async () => {
    await expectRejection(await signAssertion({ expiresIn: null }), "invalid_assertion");
  });

  test("authenticate_withExpiredAssertion_returnsExpired", async () => {
    await expectRejection(await signAssertion({ expiresIn: -600 }), "expired_assertion");
  });

  test("authenticate_withFutureNotBefore_returnsInvalid", async () => {
    await expectRejection(await signAssertion({ notBefore: 600 }), "invalid_assertion");
  });

  test("authenticate_withForeignSignature_returnsInvalid", async () => {
    await expectRejection(await signAssertion({ key: otherEsPrivateKey }), "invalid_assertion");
  });

  test("authenticate_withMissingSubject_returnsMissingSubject", async () => {
    await expectRejection(await signAssertion({ subject: null }), "missing_subject");
  });

  test("authenticate_withEmptySubject_returnsMissingSubject", async () => {
    await expectRejection(await signAssertion({ subject: "" }), "missing_subject");
  });

  test("authenticate_withAlgorithmOutsideAllowlist_rejectsEvenWhenKeyMatches", async () => {
    await expectRejection(
      await signAssertion({ alg: "RS256", key: rsaPrivateKey }),
      "invalid_assertion",
      { algorithms: ["ES256"], keyResolver: resolverFor(rsaPublicKey) },
    );
  });

  test("authenticate_withAlgNoneAssertion_rejects", async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${encode({ alg: "none", typ: "JWT" })}.${encode({
      sub: SUBJECT,
      iss: ISSUER,
      aud: AUDIENCE,
      iat: now,
      exp: now + 600,
    })}.`;

    await expectRejection(unsigned, "invalid_assertion");
  });
});
