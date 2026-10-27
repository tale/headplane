import { dump } from "js-yaml";
import { describe, expect, test } from "vitest";

import { loadConfig } from "~/server/config/load";
import { createOidcStateCookie } from "~/utils/oidc-state";

import { tempFile } from "../../support/temp";

function writeConfig(server: Record<string, string> = {}) {
  return tempFile(
    "config.yaml",
    dump({
      server: { cookie_secret: "thirtytwo-character-cookiesecret", ...server },
      headscale: { url: "http://localhost:8080" },
    }),
  );
}

describe("server.base_path", () => {
  test("defaults to /admin", async () => {
    const config = await loadConfig(await writeConfig());
    expect(config.server.base_path).toBe("/admin");
  });

  test.each(["/web", "/tools/Headplane", "/my-dashboard_2", "/dashboard.v2", "/..."])(
    "accepts %s",
    async (path) => {
      const config = await loadConfig(await writeConfig({ base_path: path }));
      expect(config.server.base_path).toBe(path);
    },
  );

  test.each(["", "/", "web", "/web/", "//web", "/..", "/web/../ui", "/web?x=1", "/web%2fui"])(
    "rejects %s",
    async (path) => {
      await expect(loadConfig(await writeConfig({ base_path: path }))).rejects.toThrow();
    },
  );

  test("scopes the OIDC state cookie to the callback under the path", async () => {
    const config = await loadConfig(await writeConfig({ base_path: "/tools/web" }));
    const cookie = createOidcStateCookie(config);

    const serialized = await cookie.serialize({
      nonce: "n",
      state: "s",
      verifier: "v",
      redirect_uri: "http://localhost/tools/web/oidc/callback",
    });

    expect(serialized).toContain("Path=/tools/web/oidc/callback");
  });
});
