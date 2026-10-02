import { dump } from "js-yaml";
import { beforeEach, describe, expect, test } from "vitest";

import { loadConfig } from "~/server/config/load";
import { createOidcStateCookie } from "~/utils/oidc-state";

import { clearFakeFiles, createFakeFile } from "../setup/overlay-fs";

const configPath = "/etc/headplane/base-path.yaml";
function writeConfig(basePath?: string) {
  createFakeFile(
    configPath,
    dump({
      server: {
        cookie_secret: "abcdefghijklmnopqrstuvwxyz123456",
        cookie_secure: false,
        ...(basePath === undefined ? {} : { base_path: basePath }),
      },
      headscale: { url: "http://localhost:8080" },
    }),
  );
}

describe("dashboard base path", () => {
  beforeEach(clearFakeFiles);

  test("defaults to the existing dashboard path", async () => {
    writeConfig();
    expect((await loadConfig(configPath)).server.base_path).toBe("/admin");
  });

  test.each(["/web", "/tools/Headplane", "/my-dashboard_2", "/dashboard.v2", "/~ui"])(
    "accepts %s",
    async (path) => {
      writeConfig(path);
      expect((await loadConfig(configPath)).server.base_path).toBe(path);
    },
  );

  test.each([
    "",
    "/",
    "web",
    "/web/",
    "//web",
    "/web//ui",
    "/../web",
    "/web/.",
    "/web/../ui",
    "/web?x=1",
    "/web#x",
    "/web%2fui",
    "/web ui",
  ])("rejects %s", async (path) => {
    writeConfig(path);
    await expect(loadConfig(configPath)).rejects.toThrow();
  });

  test("scopes the OIDC state cookie to the custom callback", async () => {
    writeConfig("/tools/web");
    const cookie = createOidcStateCookie(await loadConfig(configPath));
    expect(
      await cookie.serialize({
        nonce: "n",
        state: "s",
        verifier: "v",
        redirect_uri: "http://localhost/tools/web/oidc/callback",
      }),
    ).toContain("Path=/tools/web/oidc/callback");
  });
});
