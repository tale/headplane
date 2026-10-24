import { dump } from "js-yaml";
import { beforeEach, describe, expect, test } from "vitest";

import { loadConfig } from "~/server/config/load";

import { clearFakeFiles, createFakeFile } from "../setup/overlay-fs";

const CONFIG_PATH = "/etc/headplane/config.yaml";

function writeConfig(jwtAuth?: Record<string, unknown>) {
  createFakeFile(
    CONFIG_PATH,
    dump({
      server: {
        host: "0.0.0.0",
        port: 3000,
        cookie_secret: "abcdefghijklmnopqrstuvwxyz123456",
        cookie_secure: false,
        ...(jwtAuth ? { jwt_auth: jwtAuth } : {}),
      },
      headscale: { url: "http://localhost:8080", api_key: "hs-key" },
    }),
  );
}

const COMPLETE = {
  enabled: true,
  header: "x-goog-iap-jwt-assertion",
  issuer: "https://cloud.google.com/iap",
  jwks_endpoint: "https://www.gstatic.com/iap/verify/public_key-jwk",
  audience: "/projects/123456789/global/backendServices/987654321",
};

describe("server.jwt_auth configuration", () => {
  beforeEach(() => {
    clearFakeFiles();
  });

  test("loadConfig_withoutJwtAuthBlock_loads", async () => {
    writeConfig();
    const config = await loadConfig(CONFIG_PATH);

    expect(config.server.jwt_auth).toBeUndefined();
  });

  test("loadConfig_withCompleteJwtAuthBlock_loads", async () => {
    writeConfig(COMPLETE);
    const config = await loadConfig(CONFIG_PATH);

    expect(config.server.jwt_auth?.audience).toBe(COMPLETE.audience);
    expect(config.server.jwt_auth?.default_role).toBe("member");
  });

  test.each(["header", "issuer", "jwks_endpoint", "audience"] as const)(
    "loadConfig_withJwtAuthMissing_%s_rejects",
    async (field) => {
      const { [field]: _omitted, ...rest } = COMPLETE;
      writeConfig(rest);

      await expect(loadConfig(CONFIG_PATH)).rejects.toThrow();
    },
  );

  test.each(["issuer", "jwks_endpoint"] as const)(
    "loadConfig_withEmpty_%s_rejects",
    async (field) => {
      writeConfig({ ...COMPLETE, [field]: "" });

      await expect(loadConfig(CONFIG_PATH)).rejects.toThrow();
    },
  );
});
