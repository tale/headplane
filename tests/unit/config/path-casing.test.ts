import { dump } from "js-yaml";
import { describe, expect, test } from "vitest";

import { loadConfig } from "~/server/config/load";

import { tempFile } from "../../support/temp";

async function loadWith(overrides: {
  server?: Record<string, unknown>;
  headscale?: Record<string, unknown>;
}) {
  const path = await tempFile(
    "config.yaml",
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

  return loadConfig(path);
}

// `string.lower` rewrites the value it validates rather than rejecting it, so
// declaring a filesystem path with it silently points Headplane at a different
// directory on a case-sensitive filesystem.
describe("filesystem paths preserve their casing", () => {
  test("data_path keeps its casing", async () => {
    const config = await loadWith({ server: { data_path: "/srv/Headplane" } });

    expect(config.server.data_path).toBe("/srv/Headplane");
  });

  test("Headscale paths keep their casing", async () => {
    const config = await loadWith({
      headscale: {
        config_path: "/opt/Headscale/config.yaml",
        dns_records_path: "/opt/Headscale/records.json",
        tls_cert_path: "/opt/Headscale/Cert.pem",
      },
    });

    expect(config.headscale.config_path).toBe("/opt/Headscale/config.yaml");
    expect(config.headscale.dns_records_path).toBe("/opt/Headscale/records.json");
    expect(config.headscale.tls_cert_path).toBe("/opt/Headscale/Cert.pem");
  });

  // DNS is case-insensitive, so normalising the cookie domain is correct.
  test("cookie_domain is still lowercased", async () => {
    const config = await loadWith({ server: { cookie_domain: "Headplane.Example.COM" } });

    expect(config.server.cookie_domain).toBe("headplane.example.com");
  });
});
