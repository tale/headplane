import { describe, expect, test } from "vitest";

import { capabilitiesFor } from "~/server/headscale/api/capabilities";
import { makeNodeApi } from "~/server/headscale/api/resources/nodes";
import { makeUserApi } from "~/server/headscale/api/resources/users";
import { parseServerVersion } from "~/server/headscale/api/server-version";
import type { Transport, TransportRequest } from "~/server/headscale/api/transport";

function createTransportRecorder() {
  const calls: TransportRequest[] = [];
  const transport: Transport = {
    async request<T>(opts: TransportRequest): Promise<T> {
      calls.push(opts);
      return undefined as T;
    },
    async getPublic<T>(): Promise<T> {
      throw new Error("getPublic should not be called");
    },
    async health() {
      throw new Error("health should not be called");
    },
    async dispose() {},
  };
  return { calls, transport };
}

const capabilities = capabilitiesFor(parseServerVersion("0.28.0"));

describe("Headscale API path encoding", () => {
  test("encodes node rename names as a single URL segment", async () => {
    const { calls, transport } = createTransportRecorder();

    await makeNodeApi(transport, capabilities, "api-key").rename("2", "../../1/expire");

    expect(calls).toEqual([
      {
        method: "POST",
        path: "v1/node/2/rename/..%2F..%2F1%2Fexpire",
        apiKey: "api-key",
      },
    ]);
  });

  test("encodes user rename names as a single URL segment", async () => {
    const { calls, transport } = createTransportRecorder();

    await makeUserApi(transport, capabilities, "api-key").rename(
      "3",
      "../../../user/4/rename/pwned-user@",
    );

    expect(calls).toEqual([
      {
        method: "POST",
        path: "v1/user/3/rename/..%2F..%2F..%2Fuser%2F4%2Frename%2Fpwned-user%40",
        apiKey: "api-key",
      },
    ]);
  });
});
