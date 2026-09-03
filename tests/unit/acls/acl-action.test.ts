import { describe, expect, test, vi } from "vitest";

import { aclAction } from "~/routes/acls/acl-action";
import { authContext, requestApiContext } from "~/server/context";

function requestWithPolicy(policy: string): Request {
  const formData = new FormData();
  formData.set("policy", policy);
  return { formData: () => Promise.resolve(formData) } as unknown as Request;
}

describe("ACL action validation", () => {
  test("rejects invalid HuJSON before calling Headscale", async () => {
    const getRequestApi = vi.fn();
    const context = {
      get: (key: typeof authContext | typeof requestApiContext) => {
        if (key === authContext) {
          return {
            require: vi.fn().mockResolvedValue({}),
            can: () => true,
          };
        }
        if (key === requestApiContext) return getRequestApi;
        return undefined;
      },
    };

    const result = (await aclAction({
      request: requestWithPolicy(`{ "groups": [ }`),
      context,
      params: {},
    } as never)) as { data: { success: boolean; error: string }; init?: { status?: number } };

    expect(result.init?.status).toBe(400);
    expect(result.data).toMatchObject({ success: false, error: expect.stringContaining("Syntax") });
    expect(getRequestApi).not.toHaveBeenCalled();
  });
});
