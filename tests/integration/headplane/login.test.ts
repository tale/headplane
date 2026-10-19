import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { action } from "~/routes/auth/login/page";

import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { testedVersions } from "../../harness/versions";
import { createTestApp, type TestApp } from "../../support/app";

async function signIn(app: TestApp, form: Record<string, string>) {
  return app.call(action, "/login", { form });
}

describe.for(testedVersions())("API key sign-in on Headscale %s", (version) => {
  let tailnet: Tailnet;
  let app: TestApp;

  beforeAll(async () => {
    tailnet = await createTailnet({ version });
    app = await tailnet.headplane();
  });

  afterAll(async () => {
    await tailnet?.dispose();
  });

  test("a valid key starts a session for that key", async () => {
    const apiKey = await tailnet.server.createApiKey();

    const result = await signIn(app, { api_key: apiKey });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe("/machines");

    const cookie = (result as Response).headers.get("Set-Cookie")!.split(";")[0];
    const principal = await app.ctx.auth.require(app.request("/machines", { as: cookie }));
    expect(principal).toMatchObject({ kind: "api_key", apiKey });
  });

  test("a key Headscale doesn't know is refused", async () => {
    expect(await signIn(app, { api_key: "not-a-real-key" })).toEqual({
      success: false,
      message: "That API key is invalid or has expired.",
    });
  });

  test.for<Record<string, string>>([{}, { api_key: "" }])(
    "asks for a key when none is given (%o)",
    async (form) => {
      expect(await signIn(app, form)).toEqual({ success: false, message: "Enter an API key." });
    },
  );

  test("ignores whitespace pasted around the key", async () => {
    const apiKey = await tailnet.server.createApiKey();

    const result = await signIn(app, { api_key: `  ${apiKey}\n` });
    expect((result as Response).headers.get("Location")).toBe("/machines");
  });

  test("calls a key with stray characters invalid rather than blaming Headscale", async () => {
    const apiKey = await tailnet.server.createApiKey();

    expect(await signIn(app, { api_key: `${apiKey.slice(0, 10)}\n${apiKey.slice(10)}` })).toEqual({
      success: false,
      message: "That API key is invalid or has expired.",
    });
  });
});

test("explains when Headscale can't be reached", async () => {
  await using app = await createTestApp({
    headscale: { url: "http://127.0.0.1:1", apiKey: "unused" },
  });

  expect(await signIn(app, { api_key: "hskey-api-anything" })).toEqual({
    success: false,
    message: "Couldn't check the API key. See the server logs.",
  });
});
