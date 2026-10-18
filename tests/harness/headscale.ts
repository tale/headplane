import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import tc from "testcontainers";
import { stringify } from "yaml";

import type { HeadscaleVersion } from "./versions";

export const HEADSCALE_ALIAS = "headscale";
export const HARNESS_LABEL = "me.tale.headplane.harness";

export interface HeadscaleOptions {
  version: HeadscaleVersion;
  network?: tc.StartedNetwork;
  // Merged over the defaults one top-level key at a time.
  config?: Record<string, unknown>;
  id: string;
}

export type StartedHeadscale = Awaited<ReturnType<typeof startHeadscale>>;

export function headscaleConfig(overrides: Record<string, unknown> = {}) {
  return {
    server_url: `http://${HEADSCALE_ALIAS}:8080`,
    listen_addr: "0.0.0.0:8080",
    metrics_listen_addr: "127.0.0.1:9090",
    grpc_listen_addr: "127.0.0.1:50443",
    noise: { private_key_path: "/var/lib/headscale/noise_private.key" },
    prefixes: { v4: "100.64.0.0/10", v6: "fd7a:115c:a1e0::/48", allocation: "sequential" },
    derp: {
      server: { enabled: false },
      urls: ["https://controlplane.tailscale.com/derpmap/default"],
      paths: [],
      auto_update_enabled: false,
    },
    disable_check_updates: true,
    ephemeral_node_inactivity_timeout: "30m",
    database: {
      type: "sqlite",
      sqlite: { path: "/var/lib/headscale/db.sqlite", write_ahead_log: true },
    },
    log: { level: "info", format: "text" },
    policy: { mode: "database" },
    dns: {
      magic_dns: true,
      base_domain: "tailnet.test",
      override_local_dns: true,
      nameservers: { global: ["1.1.1.1"] },
      search_domains: [],
      extra_records: [],
    },
    unix_socket: "/var/run/headscale/headscale.sock",
    unix_socket_permission: "0770",
    logtail: { enabled: false },
    ...overrides,
  };
}

export async function startHeadscale(options: HeadscaleOptions) {
  // Mounted rather than copied so Headplane can edit it like a real deployment.
  const configDir = await mkdtemp(join(tmpdir(), "hp-harness-headscale-"));
  const configPath = join(configDir, "config.yaml");
  await writeFile(configPath, stringify(headscaleConfig(options.config)), { mode: 0o644 });
  await chmod(configDir, 0o755);

  let builder = new tc.GenericContainer(`headscale/headscale:${options.version}`)
    .withCommand(["serve"])
    .withExposedPorts(8080)
    .withBindMounts([{ source: configDir, target: "/etc/headscale" }])
    .withLabels({ [HARNESS_LABEL]: options.id })
    .withWaitStrategy(tc.Wait.forHttp("/health", 8080).forStatusCode(200))
    .withStartupTimeout(30_000);

  if (options.network) {
    builder = builder.withNetwork(options.network).withNetworkAliases(HEADSCALE_ALIAS);
  }

  const container = await builder.start();

  async function exec(args: string[]) {
    const result = await container.exec(["headscale", ...args]);
    if (result.exitCode !== 0) {
      throw new Error(`headscale ${args.join(" ")} failed:\n${result.output}`);
    }

    return result.stdout;
  }

  async function createApiKey() {
    return JSON.parse(await exec(["apikeys", "create", "-o", "json"])) as string;
  }

  return {
    version: options.version,
    container,
    configPath,
    url: `http://${container.getHost()}:${container.getMappedPort(8080)}`,
    exec,
    createApiKey,
    apiKey: await createApiKey(),

    async stop() {
      await container.stop({ remove: true, removeVolumes: true });
      await rm(configDir, { recursive: true, force: true });
    },
  };
}
