import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { createOidcService, type OidcConfig } from "~/server/oidc/provider";

import { type DexEnv, startDex } from "./start-dex";

vi.mock("~/utils/log", () => ({
  default: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

let dex: DexEnv;

beforeAll(async () => {
  dex = await startDex();
}, 60_000);

afterAll(async () => {
  await dex?.container.stop({ remove: true, removeVolumes: true });
});

function dexConfig(overrides?: Partial<OidcConfig>): OidcConfig {
  // Dex's issuer inside the container is http://0.0.0.0:5556 but we
  // connect via the mapped port. We provide manual endpoint overrides
  // pointing to the external URL so the service can actually reach them,
  // while the issuer stays as configured in Dex for JWT validation.
  return {
    issuer: "http://0.0.0.0:5556",
    clientId: "test-client",
    clientSecret: "test-secret",
    baseUrl: "http://localhost",
    authorizationEndpoint: `${dex.issuerUrl}/auth`,
    tokenEndpoint: `${dex.issuerUrl}/token`,
    userinfoEndpoint: `${dex.issuerUrl}/userinfo`,
    jwksUri: `${dex.issuerUrl}/keys`,
    ...overrides,
  };
}

describe("discovery against real Dex", () => {
  test("resolves endpoints via manual overrides", async () => {
    const svc = createOidcService(dexConfig());
    const result = await svc.discover();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.authorizationEndpoint).toContain("/auth");
    expect(result.value.tokenEndpoint).toContain("/token");
    expect(result.value.jwksUri).toContain("/keys");
  });

  test("fetches real discovery document from Dex", async () => {
    const svc = createOidcService({
      issuer: dex.issuerUrl,
      clientId: "test-client",
      clientSecret: "test-secret",
      baseUrl: "http://localhost",
    });

    const result = await svc.discover();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    // Dex returns endpoints with the internal issuer
    expect(result.value.authorizationEndpoint).toContain("/auth");
    expect(result.value.tokenEndpoint).toContain("/token");
    expect(result.value.jwksUri).toContain("/keys");
  });

  test("status is ready after discovery", async () => {
    const svc = createOidcService(dexConfig());
    await svc.discover();
    expect(svc.status().state).toBe("ready");
  });
});

describe("startFlow against real Dex", () => {
  test("builds a valid authorization URL", async () => {
    const svc = createOidcService(dexConfig());
    const result = await svc.startFlow();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const url = new URL(result.value.url);
    expect(url.pathname).toBe("/auth");
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost/admin/oidc/callback");
    expect(url.searchParams.get("scope")).toContain("openid");
  });

  test("PKCE challenge is included by default", async () => {
    const svc = createOidcService(dexConfig());
    const result = await svc.startFlow();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const url = new URL(result.value.url);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
  });
});

describe("handleCallback error handling against real Dex", () => {
  test("invalid authorization code returns error", async () => {
    const svc = createOidcService(dexConfig({ usePkce: false }));
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const { flowState } = flowResult.value;
    const params = new URLSearchParams({
      code: "invalid-code",
      state: flowState.state,
    });

    const result = await svc.handleCallback(params, flowState);
    expect(result.ok).toBe(false);
  });

  test("state mismatch detected before hitting Dex", async () => {
    const svc = createOidcService(dexConfig());
    const flowResult = await svc.startFlow();
    if (!flowResult.ok) {
      throw new Error("startFlow failed");
    }

    const params = new URLSearchParams({
      code: "any-code",
      state: "tampered-state",
    });

    const result = await svc.handleCallback(params, flowResult.value.flowState);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("state_mismatch");
  });
});

describe("invalidate and rediscovery against real Dex", () => {
  test("invalidate forces rediscovery", async () => {
    const svc = createOidcService(dexConfig());
    await svc.discover();
    expect(svc.status().state).toBe("ready");

    svc.invalidate();
    expect(svc.status().state).toBe("pending");

    const result = await svc.discover();
    expect(result.ok).toBe(true);
    expect(svc.status().state).toBe("ready");
  });
});
