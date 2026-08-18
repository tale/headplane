import { describe, expect, test, vi } from "vitest";

import { authContext, requestApiContext } from "~/server/context";

// Mock the log module to avoid console spam during tests
vi.mock("~/utils/log", () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function mockFormData(expiry: string): FormData {
  const formData = new FormData();
  formData.set("action_id", "add_preauthkey");
  formData.set("user_id", "1");
  formData.set("acl_tags", "");
  formData.set("reusable", "off");
  formData.set("ephemeral", "off");
  formData.set("expiry", expiry);
  return formData;
}

function mockRequest(formData: FormData): Request {
  return {
    formData: () => Promise.resolve(formData),
  } as unknown as Request;
}

// React Router provides context values through context.get(contextKey), so this
// returns the matching mock depending on the requested key.
function createMockContext(create: ReturnType<typeof vi.fn>) {
  return {
    get: (context: typeof authContext | typeof requestApiContext) => {
      if (context === authContext) return { can: () => true };
      if (context === requestApiContext) {
        return () => Promise.resolve({ principal: {}, api: { preAuthKeys: { create } } });
      }
      return undefined;
    },
  };
}

async function submitExpiry(expiry: string) {
  const { authKeysAction } = await import("~/routes/settings/auth-keys/actions");
  const create = vi.fn().mockResolvedValue({ key: "test-key" });

  const result = (await authKeysAction({
    request: mockRequest(mockFormData(expiry)),
    context: createMockContext(create),
    params: {},
  } as any)) as { data: unknown; init?: { status?: number } | null };

  return { result, create };
}

function daysUntil(expiration: Date): number {
  const start = new Date();
  return Math.round((expiration.getTime() - start.getTime()) / 86_400_000);
}

describe("Pre-auth key expiry parsing", () => {
  test("accepts a plain integer above the grouping threshold", async () => {
    const { result, create } = await submitExpiry("365000");

    expect(result.init?.status ?? 200).toBe(200);
    expect(create).toHaveBeenCalledOnce();
    expect(daysUntil(create.mock.calls[0][0].expiration)).toBe(365_000);
  });

  // Values >= 1000 used to be submitted through Intl.NumberFormat, which groups
  // digits differently per locale. Leniently parsing those either produced an
  // Invalid Date (500) or, for dot-grouping locales, a silently wrong expiry.
  test.for([
    ["en-US", "365,000"],
    ["ru-RU", "365 000"],
    ["fr-FR", "365 000"],
    ["de-DE", "365.000"],
  ])("rejects a locale-formatted value (%s)", async ([, expiry]) => {
    const { result, create } = await submitExpiry(expiry);

    expect(result.init?.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test.for(["0", "-1", "", "90 days", "9999999999999"])(
    "rejects an out-of-range or non-numeric value (%s)",
    async (expiry) => {
      const { result, create } = await submitExpiry(expiry);

      expect(result.init?.status).toBe(400);
      expect(create).not.toHaveBeenCalled();
    },
  );
});
