import { basename, dirname } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import type { PartialHeadplaneConfigWithPaths } from "~/server/config/config-schema";
import { ConfigError } from "~/server/config/error";
import { loadConfigKeyPaths } from "~/server/config/load";

import { tempFile } from "../../support/temp";

function withSecretPath(path: string, secret?: string) {
  return {
    server: { cookie_secret: secret, cookie_secret_path: path },
  } as PartialHeadplaneConfigWithPaths;
}

describe("Configuration secret path handling", () => {
  afterEach(() => {
    delete process.env.HP_TEST_COOKIE_SECRET_FILE;
  });

  test("reads the secret from the file and trims it", async () => {
    const path = await tempFile("cookie_secret.txt", "supersecretcookievalue\n");
    const config = withSecretPath(path);

    await loadConfigKeyPaths(config);
    expect(config.server?.cookie_secret).toBe("supersecretcookievalue");
  });

  test("a missing secret file is an error", async () => {
    const config = withSecretPath("/secrets/missing_cookie_secret.txt");

    await expect(loadConfigKeyPaths(config)).rejects.toMatchObject(
      ConfigError.from("MISSING_SECRET_FILE", {
        pathKey: "server.cookie_secret_path",
        filePath: "/secrets/missing_cookie_secret.txt",
      }),
    );
  });

  test("setting both the secret and its path is an error", async () => {
    const config = withSecretPath("/secrets/cookie_secret.txt", "explicitsecretvalue");

    await expect(loadConfigKeyPaths(config)).rejects.toMatchObject(
      ConfigError.from("CONFLICTING_SECRET_PATH_FIELD", {
        fieldName: "server.cookie_secret",
      }),
    );
  });

  test("interpolates env vars in the path", async () => {
    const path = await tempFile("cookie_secret.txt", "envvarsecretvalue");
    process.env.HP_TEST_COOKIE_SECRET_FILE = basename(path);
    const config = withSecretPath(`${dirname(path)}/\${HP_TEST_COOKIE_SECRET_FILE}`);

    await loadConfigKeyPaths(config);
    expect(config.server?.cookie_secret).toBe("envvarsecretvalue");
  });

  test("an unset interpolated env var is an error", async () => {
    const config = withSecretPath("/secrets/${MISSING_ENV_VAR}");

    await expect(loadConfigKeyPaths(config)).rejects.toMatchObject(
      ConfigError.from("MISSING_INTERPOLATION_VARIABLE", {
        pathKey: "server.cookie_secret_path",
        variableName: "MISSING_ENV_VAR",
      }),
    );
  });
});
