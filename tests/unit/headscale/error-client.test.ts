import { describe, expect, test } from "vitest";

import { headscaleErrorMessage } from "~/server/headscale/api/error-client";

function apiError(statusCode: number, rawData: string, data: Record<string, unknown> | null) {
  return { data: { requestUrl: "GET /api/v1/user", statusCode, rawData, data } };
}

describe("headscaleErrorMessage", () => {
  test("describes connection failures", () => {
    const error = {
      data: {
        requestUrl: "http://headscale:5000/api/v1/apikey",
        errorCode: "ECONNREFUSED",
        errorMessage: "connect ECONNREFUSED",
        extraData: null,
      },
    };

    expect(headscaleErrorMessage(error)).toBe(
      "Couldn't reach Headscale. Check that it's running and try again.",
    );
  });

  test("prefers the JSON message from Headscale", () => {
    const error = apiError(400, "{}", { message: "user not found" });
    expect(headscaleErrorMessage(error)).toBe("User not found");
  });

  test("falls back to the raw body", () => {
    expect(headscaleErrorMessage(apiError(401, "Unauthorized", null))).toBe("Unauthorized");
  });

  test("falls back to the status code on an empty body", () => {
    expect(headscaleErrorMessage(apiError(502, "", null))).toBe(
      "Headscale rejected the change (502).",
    );
  });

  test("ignores anything that isn't a Headscale error", () => {
    expect(headscaleErrorMessage(new Error("boom"))).toBeUndefined();
    expect(headscaleErrorMessage({ data: "nope" })).toBeUndefined();
    expect(headscaleErrorMessage(undefined)).toBeUndefined();
  });
});
