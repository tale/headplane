import { dump } from "js-yaml";
import { beforeAll, describe, expect, test } from "vitest";

import { ConfigError } from "~/server/config/error";
import { loadConfig, loadConfigFile } from "~/server/config/load";

import { clearFakeFiles, createFakeFile } from "../setup/overlay-fs";

const writeYaml = (filePath: string, content: unknown) => {
  const yamlContent = dump(content);
  createFakeFile(filePath, yamlContent);
};

describe("Configuration YAML file loading", () => {
  beforeAll(() => {
    clearFakeFiles();
  });

  test("should correctly parse different types from YAML file", async () => {
    const filePath = "/config/test-config.yaml";
    writeYaml(filePath, {
      headscale: {
        url: "http://localhost:8080",
      },
      oidc: {
        client_id: "my-client-id",
      },
      server: {
        port: 8000,
      },
      integration: {
        agent: {
          enabled: true,
        },
      },
    });

    const config = await loadConfigFile(filePath);
    expect(config?.headscale?.url).toBe("http://localhost:8080");
    expect(config?.oidc?.client_id).toBe("my-client-id");
    expect(config?.server?.port).toBe(8000);
    expect(config?.integration?.agent?.enabled).toBe(true);
  });

  test("should not throw errors for inaccessible file", async () => {
    await expect(loadConfigFile("/non-existent-path/config.yaml")).resolves.toBeUndefined();
  });

  test("should correctly get a finalized config from YAML", async () => {
    const filePath = "/config/minimal-config.yaml";
    writeYaml(filePath, {
      headscale: {
        url: "http://localhost:8080",
      },
      server: {
        cookie_secret: "thirtytwo-character-cookiesecret",
      },
    });

    const config = await loadConfig(filePath);
    expect(config.headscale.url).toBe("http://localhost:8080");
    expect(config.server.cookie_secret).toBe("thirtytwo-character-cookiesecret");
  });

  test("should throw error for missing required fields", async () => {
    const filePath = "/config/invalid-config.yaml";
    writeYaml(filePath, {
      server: {
        port: 8000,
      },
    });

    await expect(loadConfig(filePath)).rejects.toEqual(
      expect.objectContaining(ConfigError.from("INVALID_REQUIRED_FIELDS", { messages: [] })),
    );
  });

  test("oidc.enabled defaults to true when oidc section is present", async () => {
    const filePath = "/config/oidc-default-enabled.yaml";
    writeYaml(filePath, {
      headscale: { url: "http://localhost:8080" },
      server: { cookie_secret: "thirtytwo-character-cookiesecret" },
      oidc: {
        issuer: "https://accounts.google.com",
        client_id: "my-client-id",
        client_secret: "my-client-secret",
        headscale_api_key: "my-api-key",
      },
    });

    const config = await loadConfig(filePath);
    expect(config.oidc).toBeDefined();
    expect(config.oidc?.enabled).toBe(true);
  });

  test("oidc.enabled can be set to false to disable OIDC", async () => {
    const filePath = "/config/oidc-disabled.yaml";
    writeYaml(filePath, {
      headscale: { url: "http://localhost:8080" },
      server: { cookie_secret: "thirtytwo-character-cookiesecret" },
      oidc: {
        enabled: false,
        issuer: "https://accounts.google.com",
        client_id: "my-client-id",
        client_secret: "my-client-secret",
        headscale_api_key: "my-api-key",
      },
    });

    const config = await loadConfig(filePath);
    expect(config.oidc).toBeDefined();
    expect(config.oidc?.enabled).toBe(false);
  });

  test("partial oidc config with enabled field can be parsed", async () => {
    const filePath = "/config/oidc-partial.yaml";
    writeYaml(filePath, {
      headscale: { url: "http://localhost:8080" },
      server: { cookie_secret: "thirtytwo-character-cookiesecret" },
      oidc: { enabled: false },
    });

    const partialConfig = await loadConfigFile(filePath);
    expect(partialConfig?.oidc?.enabled).toBe(false);
  });

  test("config without oidc section has undefined oidc", async () => {
    const filePath = "/config/no-oidc.yaml";
    writeYaml(filePath, {
      headscale: { url: "http://localhost:8080" },
      server: { cookie_secret: "thirtytwo-character-cookiesecret" },
    });

    const config = await loadConfig(filePath);
    expect(config.oidc).toBeUndefined();
  });
});
