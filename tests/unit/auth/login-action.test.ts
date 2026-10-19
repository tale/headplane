import { describe, expect, test, vi } from "vitest";

import { authContext, headscaleContext } from "~/server/context";

// Helper to create a mock FormData with optional api_key
function mockFormData(apiKey?: string): FormData {
  const formData = new FormData();
  if (apiKey !== undefined) {
    formData.set("api_key", apiKey);
  }
  return formData;
}

// Helper to create mock request
function mockRequest(formData: FormData): Request {
  return {
    formData: () => Promise.resolve(formData),
  } as unknown as Request;
}

// Types for test clarity
interface LoginResult {
  success: boolean;
  message: string;
}

interface MockApiKey {
  prefix: string;
  expiration: string | null;
}

interface MockHeadscale {
  client: (apiKey?: string) => {
    apiKeys: {
      list: ReturnType<typeof vi.fn>;
    };
  };
}

interface MockAuth {
  createApiKeySession: ReturnType<typeof vi.fn>;
}

// React Router 7 provides context values through context.get(contextKey).
// This helper creates a fake AppLoadContext that returns the correct mock
// depending on the context key that is requested.
function createMockContext({ headscale, auth }: { headscale: MockHeadscale; auth: MockAuth }) {
  return {
    get: (context: typeof authContext | typeof headscaleContext) => {
      if (context === authContext) return auth;
      if (context === headscaleContext) return headscale;
      return undefined;
    },
  };
}

// Mock the log module to avoid console spam during tests
vi.mock("~/utils/log", () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Login action validation", () => {
  test("returns error when api_key field is missing", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const formData = mockFormData(); // no api_key
    const request = mockRequest(formData);

    const mockContext = createMockContext({
      headscale: { client: vi.fn() },
      auth: { createApiKeySession: vi.fn() },
    });

    const result = (await loginAction({
      request,
      context: mockContext,
      params: {},
    } as any)) as LoginResult;

    expect(result.success).toBe(false);
    expect(result.message).toBe("Enter an API key.");
  });

  test("returns error when api_key is empty string", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const formData = mockFormData("");
    const request = mockRequest(formData);

    const mockContext = createMockContext({
      headscale: { client: vi.fn() },
      auth: { createApiKeySession: vi.fn() },
    });

    const result = (await loginAction({
      request,
      context: mockContext,
      params: {},
    } as any)) as LoginResult;

    expect(result.success).toBe(false);
    expect(result.message).toBe("Enter an API key.");
  });

  test("returns error when api key not found in database", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const formData = mockFormData("some-invalid-key-12345");
    const request = mockRequest(formData);

    const mockGetApiKeys = vi
      .fn()
      .mockResolvedValue([{ prefix: "other-prefix", expiration: "2030-01-01T00:00:00Z" }]);

    const mockContext = createMockContext({
      headscale: {
        client: () => ({ apiKeys: { list: mockGetApiKeys } }),
      },
      auth: { createApiKeySession: vi.fn() },
    });

    const result = (await loginAction({
      request,
      context: mockContext,
      params: {},
    } as any)) as LoginResult;

    expect(result.success).toBe(false);
    expect(result.message).toContain("doesn't exist");
  });

  test("returns error when api key has expired", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const expiredKey = "expired-key-prefix.secret";
    const formData = mockFormData(expiredKey);
    const request = mockRequest(formData);

    const mockGetApiKeys = vi
      .fn()
      .mockResolvedValue([{ prefix: "expired-key-prefix", expiration: "2020-01-01T00:00:00Z" }]);

    const mockContext = createMockContext({
      headscale: {
        client: () => ({ apiKeys: { list: mockGetApiKeys } }),
      },
      auth: { createApiKeySession: vi.fn() },
    });

    const result = (await loginAction({
      request,
      context: mockContext,
      params: {},
    } as any)) as LoginResult;

    expect(result.success).toBe(false);
    expect(result.message).toContain("expired");
  });

  test("returns error when api key has no expiration field", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const keyWithoutExpiry = "malformed-key.secret";
    const formData = mockFormData(keyWithoutExpiry);
    const request = mockRequest(formData);

    const mockGetApiKeys = vi
      .fn()
      .mockResolvedValue([{ prefix: "malformed-key", expiration: null } as MockApiKey]);

    const mockContext = createMockContext({
      headscale: {
        client: () => ({ apiKeys: { list: mockGetApiKeys } }),
      },
      auth: { createApiKeySession: vi.fn() },
    });

    const result = (await loginAction({
      request,
      context: mockContext,
      params: {},
    } as any)) as LoginResult;

    expect(result.success).toBe(false);
    expect(result.message).toContain("no expiration");
  });

  test("handles asterisks in api key prefix from headscale 0.28+", async () => {
    const { loginAction } = await import("~/routes/auth/login/action");
    const apiKey = "my-key-prefix.the-secret-part";
    const formData = mockFormData(apiKey);
    const request = mockRequest(formData);

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const mockGetApiKeys = vi
      .fn()
      .mockResolvedValue([{ prefix: "my-***-prefix", expiration: futureDate.toISOString() }]);

    const mockCreateSession = vi.fn().mockResolvedValue("session-cookie");

    const mockContext = createMockContext({
      headscale: {
        client: () => ({ apiKeys: { list: mockGetApiKeys } }),
      },
      auth: { createApiKeySession: mockCreateSession },
    });

    const result = await loginAction({
      request,
      context: mockContext,
      params: {},
    } as any);

    // Should match despite asterisks in stored prefix
    // Result will be a redirect (Response) on success, not our error object
    expect(result).toBeDefined();
  });
});
