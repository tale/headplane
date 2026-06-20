import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { parse } from "yaml";

import { loadHeadscaleConfig } from "~/server/headscale/config-loader";

describe("Headscale config loader", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "headplane-config-loader-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("tolerates unknown and version-specific keys while reading known defaults", async () => {
    const path = join(dir, "config.yaml");
    await writeFile(
      path,
      [
        "server_url: http://localhost:8080",
        "future_headscale_key:",
        "  nested: true",
        "randomize_client_port: false",
        "auto_update:",
        "  enabled: true",
      ].join("\n"),
    );

    const config = await loadHeadscaleConfig(path);
    expect(config.readable()).toBe(true);
    expect(config.getDNSConfig()).toMatchObject({
      magicDns: true,
      baseDomain: "",
      nameservers: [],
      splitDns: {},
      searchDomains: [],
      overrideDns: true,
    });
  });

  test("patches only requested paths and does not write effective defaults", async () => {
    const path = join(dir, "config.yaml");
    await writeFile(
      path,
      [
        "server_url: http://localhost:8080",
        "future_headscale_key: keep-me",
        "dns:",
        "  base_domain: example.com",
      ].join("\n"),
    );

    const config = await loadHeadscaleConfig(path);
    await config.patch([{ path: "dns.magic_dns", value: false }]);

    const written = parse(await readFile(path, "utf8"));
    expect(written.future_headscale_key).toBe("keep-me");
    expect(written.dns).toEqual({
      base_domain: "example.com",
      magic_dns: false,
    });
  });

  test("reads OIDC restrictions as empty arrays when unset", async () => {
    const path = join(dir, "config.yaml");
    await writeFile(
      path,
      ["server_url: http://localhost:8080", "oidc:", "  issuer: https://issuer.example.com"].join(
        "\n",
      ),
    );

    const config = await loadHeadscaleConfig(path);
    expect(config.getOIDCConfig()).toEqual({
      issuer: "https://issuer.example.com",
      allowedDomains: [],
      allowedGroups: [],
      allowedUsers: [],
    });
  });

  test("does not treat an empty OIDC block as configured", async () => {
    const path = join(dir, "config.yaml");
    await writeFile(path, ["server_url: http://localhost:8080", "oidc: {}"].join("\n"));

    const config = await loadHeadscaleConfig(path);
    expect(config.getOIDCConfig()).toBeUndefined();
    expect(config.hasOIDCConfig()).toBe(false);
  });
});
