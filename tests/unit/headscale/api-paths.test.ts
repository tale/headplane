import { describe, expect, test } from "vitest";

import type { HeadscaleApiInterface } from "~/server/headscale/api";
import nodeEndpoints from "~/server/headscale/api/endpoints/nodes";
import userEndpoints from "~/server/headscale/api/endpoints/users";

type ApiFetchArgs = Parameters<HeadscaleApiInterface["clientHelpers"]["apiFetch"]>;

function createApiClientRecorder() {
  const calls: Array<{
    method: ApiFetchArgs[0];
    apiPath: ApiFetchArgs[1];
    apiKey: ApiFetchArgs[2];
    bodyOrQuery: ApiFetchArgs[3];
  }> = [];

  const client = {
    isAtleast: () => false,
    rawFetch: async () => {
      throw new Error("rawFetch should not be called");
    },
    apiFetch: async <T>(
      method: ApiFetchArgs[0],
      apiPath: ApiFetchArgs[1],
      apiKey: ApiFetchArgs[2],
      bodyOrQuery?: ApiFetchArgs[3],
    ) => {
      calls.push({ method, apiPath, apiKey, bodyOrQuery });
      return undefined as T;
    },
  } as HeadscaleApiInterface["clientHelpers"];

  return { calls, client };
}

describe("Headscale API path encoding", () => {
  test("encodes node rename names as a single URL segment", async () => {
    const { calls, client } = createApiClientRecorder();

    await nodeEndpoints(client, "api-key").renameNode("2", "../../1/expire");

    expect(calls).toEqual([
      {
        method: "POST",
        apiPath: "v1/node/2/rename/..%2F..%2F1%2Fexpire",
        apiKey: "api-key",
        bodyOrQuery: undefined,
      },
    ]);
  });

  test("encodes user rename names as a single URL segment", async () => {
    const { calls, client } = createApiClientRecorder();

    await userEndpoints(client, "api-key").renameUser("3", "../../../user/4/rename/pwned-user@");

    expect(calls).toEqual([
      {
        method: "POST",
        apiPath: "v1/user/3/rename/..%2F..%2F..%2Fuser%2F4%2Frename%2Fpwned-user%40",
        apiKey: "api-key",
        bodyOrQuery: undefined,
      },
    ]);
  });
});
