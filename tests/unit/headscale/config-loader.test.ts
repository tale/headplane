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

  test("tolerates unknown Headscale keys while reading known defaults", async () => {
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

  test("falls back for invalid consumed values without rejecting the whole config", async () => {
    const path = join(dir, "config.yaml");
    await writeFile(
      path,
      [
        "server_url: http://localhost:8080",
        "dns:",
        "  magic_dns: maybe",
        "  base_domain: 1234",
        "  override_local_dns: nope",
        "  nameservers:",
        "    global: 1.1.1.1",
        "    split:",
        "      example.com: 1.1.1.1",
        "  search_domains: example.com",
        "oidc:",
        "  issuer: https://issuer.example.com",
        "  allowed_domains: example.com",
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
    expect(config.getOIDCConfig()).toMatchObject({
      allowedDomains: [],
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

  test("patches quoted split DNS domains", async () => {
    const path = join(dir, "config.yaml");
    await writeFile(
      path,
      ["server_url: http://localhost:8080", "dns:", "  nameservers:", "    split: {}"].join("\n"),
    );

    const config = await loadHeadscaleConfig(path);
    await config.patch([{ path: 'dns.nameservers.split."corp.example.com"', value: ["1.1.1.1"] }]);

    const written = parse(await readFile(path, "utf8"));
    expect(written.dns.nameservers.split).toEqual({
      "corp.example.com": ["1.1.1.1"],
    });
  });

  test("prefers extra records JSON over inline YAML records", async () => {
    const path = join(dir, "config.yaml");
    const recordsPath = join(dir, "extra-records.json");
    await writeFile(recordsPath, JSON.stringify([{ name: "json", type: "A", value: "1.1.1.1" }]));
    await writeFile(
      path,
      [
        "server_url: http://localhost:8080",
        "dns:",
        "  extra_records_path: " + recordsPath,
        "  extra_records:",
        "    - name: yaml",
        "      type: A",
        "      value: 2.2.2.2",
      ].join("\n"),
    );

    const config = await loadHeadscaleConfig(path);
    expect(config.dnsRecords()).toEqual([{ name: "json", type: "A", value: "1.1.1.1" }]);

    await config.addDNS({ name: "new", type: "A", value: "3.3.3.3" });

    expect(JSON.parse(await readFile(recordsPath, "utf8"))).toEqual([
      { name: "json", type: "A", value: "1.1.1.1" },
      { name: "new", type: "A", value: "3.3.3.3" },
    ]);
    expect(parse(await readFile(path, "utf8")).dns.extra_records).toEqual([
      { name: "yaml", type: "A", value: "2.2.2.2" },
    ]);
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
