import { dump } from "js-yaml";
import { beforeEach, describe, expect, test } from "vitest";

import { loadConfig } from "~/server/config/load";

import { clearFakeFiles, createFakeFile } from "../setup/overlay-fs";

const CONFIG_PATH = "/etc/headplane/config.yaml";

function writeConfig(overrides: {
  server?: Record<string, unknown>;
  headscale?: Record<string, unknown>;
}) {
  createFakeFile(
    CONFIG_PATH,
    dump({
      server: {
        host: "0.0.0.0",
        port: 3000,
        cookie_secret: "abcdefghijklmnopqrstuvwxyz123456",
        cookie_secure: false,
        ...overrides.server,
      },
      headscale: { url: "http://localhost:8080", ...overrides.headscale },
    }),
  );
}

// `string.lower` rewrites the value it validates rather than rejecting it, so
// declaring a filesystem path with it silently points Headplane at a different
// directory on a case-sensitive filesystem.
describe("filesystem paths preserve their casing", () => {
  beforeEach(() => {
    clearFakeFiles();
  });

  test("loadConfig_withMixedCaseDataPath_preservesIt", async () => {
    writeConfig({ server: { data_path: "/srv/Headplane" } });
    const config = await loadConfig(CONFIG_PATH);

    expect(config.server.data_path).toBe("/srv/Headplane");
  });

  test("loadConfig_withMixedCaseHeadscalePaths_preservesThem", async () => {
    writeConfig({
      headscale: {
        config_path: "/opt/Headscale/config.yaml",
        dns_records_path: "/opt/Headscale/records.json",
        tls_cert_path: "/opt/Headscale/Cert.pem",
      },
    });
    const config = await loadConfig(CONFIG_PATH);

    expect(config.headscale.config_path).toBe("/opt/Headscale/config.yaml");
    expect(config.headscale.dns_records_path).toBe("/opt/Headscale/records.json");
    expect(config.headscale.tls_cert_path).toBe("/opt/Headscale/Cert.pem");
  });

  test("loadConfig_withMixedCaseCookieDomain_stillLowercasesIt", async () => {
    // Not a path: DNS is case-insensitive, so normalising here is correct and
    // should stay.
    writeConfig({ server: { cookie_domain: "Headplane.Example.COM" } });
    const config = await loadConfig(CONFIG_PATH);

    expect(config.server.cookie_domain).toBe("headplane.example.com");
  });
});
