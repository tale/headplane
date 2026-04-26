import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { createOidcService, type OidcConfig } from "~/server/oidc/provider";

vi.mock("~/utils/log", () => ({
  default: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

let server: Server;
let baseUrl: string;
let privateKey: CryptoKey;
let publicJwk: Record<string, unknown>;
let weakPrivateKey: KeyObject;
let weakPublicJwk: Record<string, unknown>;

const CLIENT_ID = "test-client";
const CLIENT_SECRET = "test-secret";

let tokenHandler: (req: IncomingMessage, res: ServerResponse) => void;
let userinfoHandler: ((req: IncomingMessage, res: ServerResponse) => void) | undefined;

async function signIdToken(
  claims: Record<string, unknown>,
  nonce?: string,
  signingKey: CryptoKey | KeyObject = privateKey,
) {
  const jwt = new SignJWT({ nonce, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(baseUrl)
    .setAudience(CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime("5m");

  return jwt.sign(signingKey);
}

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signWeakRs256IdToken(
  claims: Record<string, unknown>,
  nonce?: string,
  options?: { kid?: string },
) {
  const header = { alg: "RS256", kid: options?.kid ?? "test-key", typ: "JWT" };
  const payload = {
    nonce,
    ...claims,
    iss: baseUrl,
    aud: CLIENT_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
  };

  const signingInput = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(payload))}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), weakPrivateKey);
  return `${signingInput}.${encodeBase64Url(signature)}`;
}

// You would think this is a lot better in 2026, but no
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on("end", () => resolve(body));
  });
}

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256");
  privateKey = keyPair.privateKey as CryptoKey;
  const exported = await exportJWK(keyPair.publicKey);
  publicJwk = { ...exported, kid: "test-key", use: "sig", alg: "RS256" };

  const weakKeyPair = generateKeyPairSync("rsa", {
    modulusLength: 1024,
    publicExponent: 0x10001,
  });
  weakPrivateKey = weakKeyPair.privateKey;
  const weakExported = await exportJWK(weakKeyPair.publicKey);
  weakPublicJwk = { ...weakExported, kid: "test-key", use: "sig", alg: "RS256" };

  server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");

    if (url.pathname === "/.well-known/openid-configuration") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/authorize`,
          token_endpoint: `${baseUrl}/token`,
          userinfo_endpoint: `${baseUrl}/userinfo`,
          jwks_uri: `${baseUrl}/jwks`,
          end_session_endpoint: `${baseUrl}/logout`,
        }),
      );

      return;
    }

    if (url.pathname === "/jwks") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }

    if (url.pathname === "/token") {
      tokenHandler(req, res);
      return;
    }

    if (url.pathname === "/userinfo" && userinfoHandler) {
      userinfoHandler(req, res);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (typeof addr === "object" && addr) {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }

      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

function testConfig(overrides?: Partial<OidcConfig>): OidcConfig {
  return {
    issuer: baseUrl,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    baseUrl: "https://headplane.example.com",
    ...overrides,
  };
}

describe("status", () => {
  test("returns pending before discovery", () => {
    const svc = createOidcService(testConfig());
    expect(svc.status().state).toBe("pending");
  });

  test("returns ready after successful discovery", async () => {
    const svc = createOidcService(testConfig());
    await svc.discover();
    expect(svc.status().state).toBe("ready");
  });

  test("returns error after failed discovery", async () => {
    const svc = createOidcService(testConfig({ issuer: "http://127.0.0.1:1" }));
    await svc.discover();
    const status = svc.status();

    expect(status.state).toBe("error");
    if (status.state === "error") {
      expect(status.error.code).toBe("discovery_failed");
    }
  });
});

describe("discover", () => {
  test("resolves endpoints from discovery document", async () => {
    const svc = createOidcService(testConfig());
    const result = await svc.discover();
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.authorizationEndpoint).toBe(`${baseUrl}/authorize`);
      expect(result.value.tokenEndpoint).toBe(`${baseUrl}/token`);
      expect(result.value.jwksUri).toBe(`${baseUrl}/jwks`);
      expect(result.value.userinfoEndpoint).toBe(`${baseUrl}/userinfo`);
      expect(result.value.endSessionEndpoint).toBe(`${baseUrl}/logout`);
    }
  });

  test("caches successful discovery", async () => {
    const svc = createOidcService(testConfig());
    const first = await svc.discover();
    const second = await svc.discover();
    expect(first).toStrictEqual(second);
  });

  test("skips discovery when all endpoints are manual", async () => {
    const svc = createOidcService(
      testConfig({
        issuer: "http://127.0.0.1:1",
        authorizationEndpoint: "http://example.com/auth",
        tokenEndpoint: "http://example.com/token",
        jwksUri: "http://example.com/jwks",
      }),
    );

    const result = await svc.discover();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.authorizationEndpoint).toBe("http://example.com/auth");
    }
  });

  test("returns missing_endpoints when discovery is incomplete", async () => {
    const incomplete = createServer((_, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          issuer: "http://localhost",
          authorization_endpoint: "http://localhost/auth",
        }),
      );
    });

    await new Promise<void>((resolve) => incomplete.listen(0, "127.0.0.1", resolve));
    const addr = incomplete.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;

    const svc = createOidcService(testConfig({ issuer: `http://127.0.0.1:${port}` }));
    const result = await svc.discover();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("missing_endpoints");
    }

    incomplete.close();
  });

  test("retries after failure on next call", async () => {
    const svc = createOidcService(testConfig({ issuer: "http://127.0.0.1:1" }));
    const r1 = await svc.discover();
    expect(r1.ok).toBe(false);

    svc.reload(testConfig());
    const r2 = await svc.discover();
    expect(r2.ok).toBe(true);
  });

  test("config overrides take precedence over discovery", async () => {
    const svc = createOidcService(
      testConfig({
        authorizationEndpoint: "http://override.example.com/auth",
      }),
    );

    const result = await svc.discover();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.authorizationEndpoint).toBe("http://override.example.com/auth");
      expect(result.value.tokenEndpoint).toBe(`${baseUrl}/token`);
    }
  });
});

describe("invalidate and reload", () => {
  test("invalidate resets to pending", async () => {
    const svc = createOidcService(testConfig());
    await svc.discover();
    expect(svc.status().state).toBe("ready");

    svc.invalidate();
    expect(svc.status().state).toBe("pending");
  });

  test("reload clears state and applies new config", async () => {
    const svc = createOidcService(testConfig());
    await svc.discover();

    svc.reload(testConfig({ issuer: "http://127.0.0.1:1" }));
    expect(svc.status().state).toBe("pending");

    const result = await svc.discover();
    expect(result.ok).toBe(false);
  });
});

describe("startFlow", () => {
  test("builds authorization URL with required params", async () => {
    const svc = createOidcService(testConfig());
    const result = await svc.startFlow();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const url = new URL(result.value.url);
    expect(`${url.origin}${url.pathname}`).toBe(`${baseUrl}/authorize`);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe(result.value.flowState.state);
    expect(url.searchParams.get("nonce")).toBe(result.value.flowState.nonce);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://headplane.example.com/admin/oidc/callback",
    );
  });

  test("includes PKCE challenge by default", async () => {
    const svc = createOidcService(testConfig());
    const result = await svc.startFlow();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const url = new URL(result.value.url);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(result.value.flowState.codeVerifier).toBeTruthy();
  });

  test("omits PKCE when disabled", async () => {
    const svc = createOidcService(testConfig({ usePkce: false }));
    const result = await svc.startFlow();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const url = new URL(result.value.url);
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(url.searchParams.has("code_challenge_method")).toBe(false);
  });

  test("uses custom scope", async () => {
    const svc = createOidcService(testConfig({ scope: "openid email" }));
    const result = await svc.startFlow();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const url = new URL(result.value.url);
    expect(url.searchParams.get("scope")).toBe("openid email");
  });

  test("passes extra_params", async () => {
    const svc = createOidcService(
      testConfig({
        extraParams: { prompt: "select_account", hd: "example.com" },
      }),
    );

    const result = await svc.startFlow();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const url = new URL(result.value.url);
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("hd")).toBe("example.com");
  });

  test("generates unique state and nonce per call", async () => {
    const svc = createOidcService(testConfig());
    const r1 = await svc.startFlow();
    const r2 = await svc.startFlow();

    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;

    expect(r1.value.flowState.state).not.toBe(r2.value.flowState.state);
    expect(r1.value.flowState.nonce).not.toBe(r2.value.flowState.nonce);
  });
});

describe("handleCallback", () => {
  test("successful flow returns identity", async () => {
    const svc = createOidcService(testConfig({ usePkce: false }));
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) throw new Error("startFlow failed");
    const { flowState } = flowResult.value;

    const idToken = await signIdToken(
      {
        sub: "user-123",
        name: "Test User",
        email: "test@example.com",
        preferred_username: "testuser",
      },
      flowState.nonce,
    );

    tokenHandler = async (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          access_token: "mock-access-token",
          id_token: idToken,
          token_type: "Bearer",
        }),
      );
    };

    userinfoHandler = undefined;
    const params = new URLSearchParams({ code: "test-code", state: flowState.state });
    const result = await svc.handleCallback(params, flowState);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.issuer).toBe(baseUrl);
    expect(result.value.subject).toBe("user-123");
    expect(result.value.name).toBe("Test User");
    expect(result.value.email).toBe("test@example.com");
    expect(result.value.username).toBe("testuser");
  });

  test("state mismatch returns error", async () => {
    const svc = createOidcService(testConfig({ usePkce: false }));
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) throw new Error("startFlow failed");
    const { flowState } = flowResult.value;

    const params = new URLSearchParams({ code: "test-code", state: "wrong-state" });
    const result = await svc.handleCallback(params, flowState);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("state_mismatch");
  });

  test("provider error in callback params", async () => {
    const svc = createOidcService(testConfig());
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) throw new Error("startFlow failed");

    const params = new URLSearchParams({
      error: "access_denied",
      error_description: "User denied",
    });

    const result = await svc.handleCallback(params, flowResult.value.flowState);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("token_exchange_failed");
  });

  test("missing authorization code", async () => {
    const svc = createOidcService(testConfig({ usePkce: false }));
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;

    const params = new URLSearchParams({ state: flowState.state });
    const result = await svc.handleCallback(params, flowState);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("token_exchange_failed");
  });

  test("nonce mismatch returns error", async () => {
    const svc = createOidcService(testConfig({ usePkce: false }));
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    const idToken = await signIdToken({ sub: "user-123" }, "wrong-nonce");

    tokenHandler = async (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          access_token: "mock-access-token",
          id_token: idToken,
          token_type: "Bearer",
        }),
      );
    };

    userinfoHandler = undefined;
    const params = new URLSearchParams({ code: "test-code", state: flowState.state });
    const result = await svc.handleCallback(params, flowState);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("nonce_mismatch");
  });

  test("missing sub claim returns error", async () => {
    const svc = createOidcService(testConfig({ usePkce: false }));
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    const jwt = new SignJWT({ nonce: flowState.nonce })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(baseUrl)
      .setAudience(CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime("5m");

    const idToken = await jwt.sign(privateKey);
    tokenHandler = async (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          access_token: "mock-access-token",
          id_token: idToken,
          token_type: "Bearer",
        }),
      );
    };

    userinfoHandler = undefined;
    const params = new URLSearchParams({ code: "test-code", state: flowState.state });
    const result = await svc.handleCallback(params, flowState);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("missing_sub");
  });

  test("rejects RS256 id tokens signed with 1024-bit RSA keys by default", async () => {
    const originalPublicJwk = publicJwk;
    publicJwk = weakPublicJwk;

    try {
      const svc = createOidcService(testConfig({ usePkce: false }));
      const flowResult = await svc.startFlow();
      if (!flowResult.ok) {
        throw new Error("startFlow failed");
      }

      const { flowState } = flowResult.value;
      const idToken = signWeakRs256IdToken({ sub: "weak-key-user" }, flowState.nonce);

      tokenHandler = async (_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            access_token: "mock-access-token",
            id_token: idToken,
            token_type: "Bearer",
          }),
        );
      };

      userinfoHandler = undefined;
      const params = new URLSearchParams({ code: "test-code", state: flowState.state });
      const result = await svc.handleCallback(params, flowState);

      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }

      expect(result.error.code).toBe("invalid_id_token");
      expect(result.error.hint).toContain("allow_weak_rsa_keys");
    } finally {
      publicJwk = originalPublicJwk;
    }
  });

  test("accepts RS256 id tokens signed with 1024-bit RSA keys when explicitly enabled", async () => {
    const originalPublicJwk = publicJwk;
    publicJwk = weakPublicJwk;

    try {
      const svc = createOidcService(testConfig({ usePkce: false, allowWeakRsaKeys: true }));
      const flowResult = await svc.startFlow();
      if (!flowResult.ok) {
        throw new Error("startFlow failed");
      }

      const { flowState } = flowResult.value;
      const idToken = signWeakRs256IdToken({ sub: "weak-key-user" }, flowState.nonce);

      tokenHandler = async (_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            access_token: "mock-access-token",
            id_token: idToken,
            token_type: "Bearer",
          }),
        );
      };

      userinfoHandler = undefined;
      const params = new URLSearchParams({ code: "test-code", state: flowState.state });
      const result = await svc.handleCallback(params, flowState);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.value.subject).toBe("weak-key-user");
    } finally {
      publicJwk = originalPublicJwk;
    }
  });

  test("rejects weak RSA fallback when token kid does not match any JWKS key", async () => {
    const originalPublicJwk = publicJwk;
    publicJwk = weakPublicJwk;

    try {
      const svc = createOidcService(testConfig({ usePkce: false, allowWeakRsaKeys: true }));
      await svc.discover();
      svc.reload({
        ...testConfig({
          usePkce: false,
          allowWeakRsaKeys: true,
          authorizationEndpoint: `${baseUrl}/authorize`,
          tokenEndpoint: `${baseUrl}/token`,
          jwksUri: `${baseUrl}/jwks`,
        }),
      });
      const flowResult = await svc.startFlow();
      if (!flowResult.ok) {
        throw new Error("startFlow failed");
      }

      const { flowState } = flowResult.value;
      const idToken = signWeakRs256IdToken({ sub: "weak-key-user" }, flowState.nonce, {
        kid: "missing-key",
      });

      tokenHandler = async (_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            access_token: "mock-access-token",
            id_token: idToken,
            token_type: "Bearer",
          }),
        );
      };

      userinfoHandler = undefined;
      const params = new URLSearchParams({ code: "test-code", state: flowState.state });
      const result = await svc.handleCallback(params, flowState);

      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }

      expect(result.error.code).toBe("invalid_id_token");
      expect(result.error.message).toContain("no applicable key found");
    } finally {
      publicJwk = originalPublicJwk;
    }
  });

  test("uses configured open_id fallback when sub claim is missing", async () => {
    const svc = createOidcService(
      testConfig({ usePkce: false, subjectClaims: ["open_id", "email"] }),
    );
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    const idToken = await signIdToken(
      { open_id: "feishu-open-id", name: "Feishu User" },
      flowState.nonce,
    );

    tokenHandler = async (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          access_token: "mock-access-token",
          id_token: idToken,
          token_type: "Bearer",
        }),
      );
    };

    userinfoHandler = undefined;
    const params = new URLSearchParams({ code: "test-code", state: flowState.state });
    const result = await svc.handleCallback(params, flowState);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.subject).toBe("feishu-open-id");
  });

  test("uses configured fallback claim from userinfo when id token is missing subject", async () => {
    const svc = createOidcService(
      testConfig({ usePkce: false, subjectClaims: ["open_id", "email"] }),
    );
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    const idToken = await signIdToken({ name: "Feishu User" }, flowState.nonce);

    tokenHandler = async (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          access_token: "mock-access-token",
          id_token: idToken,
          token_type: "Bearer",
        }),
      );
    };

    userinfoHandler = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ open_id: "userinfo-open-id", email: "user@example.com" }));
    };

    const params = new URLSearchParams({ code: "test-code", state: flowState.state });
    const result = await svc.handleCallback(params, flowState);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.subject).toBe("userinfo-open-id");
  });

  test("invalid_client triggers auth method retry", async () => {
    const svc = createOidcService(testConfig({ usePkce: false }));
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    const idToken = await signIdToken({ sub: "user-123", name: "Test" }, flowState.nonce);

    let callCount = 0;
    tokenHandler = async (req, res) => {
      callCount++;
      const body = await readBody(req);
      const bodyParams = new URLSearchParams(body);

      if (callCount === 1 && bodyParams.has("client_secret")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_client", error_description: "Use basic auth" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          access_token: "mock-access-token",
          id_token: idToken,
          token_type: "Bearer",
        }),
      );
    };

    userinfoHandler = undefined;
    const params = new URLSearchParams({ code: "test-code", state: flowState.state });
    const result = await svc.handleCallback(params, flowState);

    expect(result.ok).toBe(true);
    expect(callCount).toBe(2);
  });

  test("token exchange uses client_secret_post by default", async () => {
    const svc = createOidcService(testConfig({ usePkce: false }));
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    const idToken = await signIdToken({ sub: "user-123", name: "Test" }, flowState.nonce);

    let receivedAuth: string | undefined;
    let receivedBody = "";
    tokenHandler = async (req, res) => {
      receivedAuth = req.headers.authorization;
      receivedBody = await readBody(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: "at", id_token: idToken, token_type: "Bearer" }));
    };

    userinfoHandler = undefined;
    const params = new URLSearchParams({ code: "test-code", state: flowState.state });
    await svc.handleCallback(params, flowState);

    expect(receivedAuth).toBeUndefined();
    const bodyParams = new URLSearchParams(receivedBody);
    expect(bodyParams.get("client_id")).toBe(CLIENT_ID);
    expect(bodyParams.get("client_secret")).toBe(CLIENT_SECRET);
  });

  test("explicit client_secret_basic sends Authorization header", async () => {
    const svc = createOidcService(
      testConfig({
        usePkce: false,
        tokenEndpointAuthMethod: "client_secret_basic",
      }),
    );

    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    const idToken = await signIdToken({ sub: "user-123", name: "Test" }, flowState.nonce);

    let receivedAuth: string | undefined;
    tokenHandler = async (req, res) => {
      receivedAuth = req.headers.authorization;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: "at", id_token: idToken, token_type: "Bearer" }));
    };

    userinfoHandler = undefined;
    const params = new URLSearchParams({ code: "test-code", state: flowState.state });
    await svc.handleCallback(params, flowState);

    expect(receivedAuth).toBeDefined();
    expect(receivedAuth!.startsWith("Basic ")).toBe(true);
  });
});

describe("identity resolution", () => {
  async function flowWithClaims(
    claims: Record<string, unknown>,
    configOverrides?: Partial<OidcConfig>,
  ) {
    const svc = createOidcService(testConfig({ usePkce: false, ...configOverrides }));
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    const idToken = await signIdToken({ ...claims }, flowState.nonce);

    tokenHandler = async (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: "at", id_token: idToken, token_type: "Bearer" }));
    };

    userinfoHandler = undefined;
    const params = new URLSearchParams({ code: "c", state: flowState.state });
    return svc.handleCallback(params, flowState);
  }

  test("uses name claim directly", async () => {
    const result = await flowWithClaims({ sub: "u1", name: "Alice Smith" });
    expect(result.ok && result.value.name).toBe("Alice Smith");
  });

  test("falls back to given_name + family_name", async () => {
    const result = await flowWithClaims({
      sub: "u1",
      given_name: "Alice",
      family_name: "Smith",
    });

    expect(result.ok && result.value.name).toBe("Alice Smith");
  });

  test("falls back to preferred_username for name", async () => {
    const result = await flowWithClaims({ sub: "u1", preferred_username: "asmith" });
    expect(result.ok && result.value.name).toBe("asmith");
  });

  test("falls back to SSO User", async () => {
    const result = await flowWithClaims({ sub: "u1" });
    expect(result.ok && result.value.name).toBe("SSO User");
  });

  test("username from preferred_username", async () => {
    const result = await flowWithClaims({ sub: "u1", preferred_username: "alice" });
    expect(result.ok && result.value.username).toBe("alice");
  });

  test("username falls back to email local part", async () => {
    const result = await flowWithClaims({ sub: "u1", email: "alice@example.com" });
    expect(result.ok && result.value.username).toBe("alice");
  });

  test("username falls back to 'user'", async () => {
    const result = await flowWithClaims({ sub: "u1" });
    expect(result.ok && result.value.username).toBe("user");
  });

  test("gravatar picture from email", async () => {
    const result = await flowWithClaims(
      { sub: "u1", email: "test@example.com" },
      { profilePictureSource: "gravatar" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.picture).toMatch(/gravatar\.com\/avatar\//);
  });

  test("oidc picture from claims", async () => {
    const result = await flowWithClaims({
      sub: "u1",
      picture: "https://example.com/photo.jpg",
    });

    expect(result.ok && result.value.picture).toBe("https://example.com/photo.jpg");
  });
});

describe("userinfo enrichment", () => {
  test("enriches missing claims from userinfo", async () => {
    const svc = createOidcService(testConfig({ usePkce: false }));
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    const idToken = await signIdToken({ sub: "user-123" }, flowState.nonce);

    tokenHandler = async (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: "at", id_token: idToken, token_type: "Bearer" }));
    };

    userinfoHandler = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          sub: "user-123",
          name: "From UserInfo",
          email: "userinfo@example.com",
        }),
      );
    };

    const params = new URLSearchParams({ code: "c", state: flowState.state });
    const result = await svc.handleCallback(params, flowState);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.name).toBe("From UserInfo");
    expect(result.value.email).toBe("userinfo@example.com");
  });

  test("skips userinfo when id token has all claims", async () => {
    const svc = createOidcService(testConfig({ usePkce: false }));
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    const idToken = await signIdToken(
      {
        sub: "user-123",
        name: "From Token",
        email: "token@example.com",
        picture: "https://example.com/pic.jpg",
      },
      flowState.nonce,
    );

    tokenHandler = async (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: "at", id_token: idToken, token_type: "Bearer" }));
    };

    let userinfoCalledCount = 0;
    userinfoHandler = (_req, res) => {
      userinfoCalledCount++;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ name: "Should Not Use" }));
    };

    const params = new URLSearchParams({ code: "c", state: flowState.state });
    const result = await svc.handleCallback(params, flowState);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.name).toBe("From Token");
    expect(userinfoCalledCount).toBe(0);
  });

  test("userinfo failure does not block login", async () => {
    const svc = createOidcService(testConfig({ usePkce: false }));
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    const idToken = await signIdToken({ sub: "user-123" }, flowState.nonce);

    tokenHandler = async (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: "at", id_token: idToken, token_type: "Bearer" }));
    };

    userinfoHandler = (_req, res) => {
      res.writeHead(500);
      res.end("Internal Server Error");
    };

    const params = new URLSearchParams({ code: "c", state: flowState.state });
    const result = await svc.handleCallback(params, flowState);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.subject).toBe("user-123");
    expect(result.value.name).toBe("SSO User");
  });
});

describe("pkce detection", () => {
  test("detects pkce error from provider response", async () => {
    const svc = createOidcService(testConfig());
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    tokenHandler = async (_req, res) => {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "invalid_request",
          error_description: "code_verifier is required",
        }),
      );
    };

    const params = new URLSearchParams({ code: "c", state: flowState.state });
    const result = await svc.handleCallback(params, flowState);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("pkce_error");
  });
});

describe("path-based issuers", () => {
  test("handles issuer with path correctly", async () => {
    const pathServer = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          issuer: "http://localhost/realms/test",
          authorization_endpoint: "http://localhost/realms/test/auth",
          token_endpoint: "http://localhost/realms/test/token",
          jwks_uri: "http://localhost/realms/test/jwks",
        }),
      );
    });

    await new Promise<void>((resolve) => pathServer.listen(0, "127.0.0.1", resolve));
    const addr = pathServer.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;

    const svc = createOidcService(
      testConfig({
        issuer: `http://127.0.0.1:${port}/realms/test`,
      }),
    );

    const result = await svc.discover();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.authorizationEndpoint).toBe("http://localhost/realms/test/auth");
    }

    pathServer.close();
  });
});
