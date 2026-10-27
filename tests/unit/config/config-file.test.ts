import { dump } from "js-yaml";
import { describe, expect, test } from "vitest";

import { ConfigError } from "~/server/config/error";
import { loadConfig, loadConfigFile } from "~/server/config/load";

import { tempFile } from "../../support/temp";

const base = {
  headscale: { url: "http://localhost:8080" },
  server: { cookie_secret: "thirtytwo-character-cookiesecret" },
};

const oidc = {
  issuer: "https://accounts.google.com",
  client_id: "my-client-id",
  client_secret: "my-client-secret",
  headscale_api_key: "my-api-key",
};

function writeConfig(content: unknown) {
  return tempFile("config.yaml", dump(content));
}

describe("Configuration YAML file loading", () => {
  test("a missing file is not an error", async () => {
    await expect(loadConfigFile("/non-existent-path/config.yaml")).resolves.toBeUndefined();
  });

  test("rejects a config without required fields", async () => {
    const path = await writeConfig({ server: { port: 8000 } });

    await expect(loadConfig(path)).rejects.toEqual(
      expect.objectContaining(ConfigError.from("INVALID_REQUIRED_FIELDS", { messages: [] })),
    );
  });

  test("an oidc section is enabled unless it says otherwise", async () => {
    const enabled = await loadConfig(await writeConfig({ ...base, oidc }));
    const disabled = await loadConfig(
      await writeConfig({ ...base, oidc: { ...oidc, enabled: false } }),
    );

    expect(enabled.oidc?.enabled).toBe(true);
    expect(disabled.oidc?.enabled).toBe(false);
  });

  test("oidc.subject_claims are trimmed, deduplicated, and drop empty values", async () => {
    const path = await writeConfig({
      ...base,
      oidc: { ...oidc, subject_claims: [" open_id ", "", "email", "open_id", "  "] },
    });

    const config = await loadConfig(path);
    expect(config.oidc?.subject_claims).toEqual(["open_id", "email"]);
  });

  test("weak RSA keys are rejected unless explicitly allowed", async () => {
    const path = await writeConfig({ ...base, oidc });

    const config = await loadConfig(path);
    expect(config.oidc?.allow_weak_rsa_keys).toBe(false);
  });

  test("agent tailscale_netns defaults to true and can be disabled", async () => {
    const headscale = { ...base.headscale, api_key: "my-api-key" };
    const byDefault = await loadConfig(
      await writeConfig({ ...base, headscale, integration: { agent: { enabled: true } } }),
    );
    const disabled = await loadConfig(
      await writeConfig({
        ...base,
        headscale,
        integration: { agent: { enabled: true, tailscale_netns: false } },
      }),
    );

    expect(byDefault.integration?.agent?.tailscale_netns).toBe(true);
    expect(disabled.integration?.agent?.tailscale_netns).toBe(false);
  });
});
