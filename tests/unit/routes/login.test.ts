import { describe, expect, test } from "vitest";

import { action } from "~/routes/auth/login/page";

import { HEADSCALE_VERSIONS } from "../../harness/versions";
import { createTestApp, type TestApp } from "../../support/app";

async function signIn(app: TestApp, form: Record<string, string>) {
  return app.call(action as never, "/login", { form });
}

describe.for(HEADSCALE_VERSIONS)("API key sign-in on Headscale %s", (version) => {
  test("a valid key starts a session for that key", async () => {
    await using app = await createTestApp({ version });
    const apiKey = app.fake!.createApiKey();

    const result = await signIn(app, { api_key: apiKey });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe("/machines");

    const cookie = (result as Response).headers.get("Set-Cookie")!.split(";")[0];
    const principal = await app.ctx.auth.require(app.request("/machines", { as: cookie }));
    expect(principal).toMatchObject({ kind: "api_key", apiKey });
  });

  test("a key Headscale doesn't know is refused", async () => {
    await using app = await createTestApp({ version });

    expect(await signIn(app, { api_key: "not-a-real-key" })).toEqual({
      success: false,
      message: "That API key is invalid or has expired.",
    });
  });
});

describe("API key sign-in", () => {
  test.for([{}, { api_key: "" }])("asks for a key when none is given (%o)", async (form) => {
    await using app = await createTestApp();

    expect(await signIn(app, form)).toEqual({ success: false, message: "Enter an API key." });
  });

  test("explains when Headscale can't be reached", async () => {
    await using app = await createTestApp();
    const apiKey = app.fake!.createApiKey();
    app.fake!.setReachable(false);

    expect(await signIn(app, { api_key: apiKey })).toEqual({
      success: false,
      message: "Couldn't check the API key. See the server logs.",
    });
  });
});
