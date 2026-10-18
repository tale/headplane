import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import tc from "testcontainers";
import { stringify } from "yaml";

import { HARNESS_LABEL, HEADSCALE_ALIAS } from "./constants";
import { harnessCertificate } from "./tls";
import type { HeadscaleVersion } from "./versions";

export { HARNESS_LABEL, HEADSCALE_ALIAS };

export interface HeadscaleOptions {
  version: HeadscaleVersion;
  network?: tc.StartedNetwork;
  // Merged over the defaults one top-level key at a time.
  config?: Record<string, unknown>;
  labels?: Record<string, string>;
  // Serves HTTPS on 443 with the harness certificate, as nodes need.
  tls?: boolean;
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

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function startHeadscale(options: HeadscaleOptions) {
  // Mounted rather than copied so Headplane can edit it like a real deployment.
  const configDir = await mkdtemp(join(tmpdir(), "hp-harness-headscale-"));
  const configPath = join(configDir, "config.yaml");
  const certificate = options.tls ? await harnessCertificate() : undefined;
  const listen = certificate
    ? {
        server_url: `https://${HEADSCALE_ALIAS}`,
        listen_addr: "0.0.0.0:443",
        tls_cert_path: "/etc/headscale/tls.crt",
        tls_key_path: "/etc/headscale/tls.key",
      }
    : {};

  if (certificate) {
    await writeFile(join(configDir, "tls.crt"), certificate.cert, { mode: 0o644 });
    await writeFile(join(configDir, "tls.key"), certificate.key, { mode: 0o644 });
  }

  await writeFile(configPath, stringify(headscaleConfig({ ...listen, ...options.config })), {
    mode: 0o644,
  });
  await chmod(configDir, 0o755);
  const containerPort = certificate ? 443 : 8080;

  // A fixed host port survives restarts, which Headplane's Docker
  // integration does after editing the config.
  const port = await freePort();
  let builder = new tc.GenericContainer(`headscale/headscale:${options.version}`)
    .withCommand(["serve"])
    .withExposedPorts({ container: containerPort, host: port })
    .withBindMounts([{ source: configDir, target: "/etc/headscale" }])
    .withLabels({ [HARNESS_LABEL]: options.id, ...options.labels })
    .withWaitStrategy(
      certificate
        ? tc.Wait.forHttp("/health", containerPort).usingTls().allowInsecure().forStatusCode(200)
        : tc.Wait.forHttp("/health", containerPort).forStatusCode(200),
    )
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
    url: certificate ? `https://localhost:${port}` : `http://${container.getHost()}:${port}`,
    controlUrl: certificate ? `https://${HEADSCALE_ALIAS}` : `http://${HEADSCALE_ALIAS}:8080`,
    certPath: certificate?.certPath,
    exec,
    createApiKey,
    apiKey: await createApiKey(),

    async stop() {
      await container.stop({ remove: true, removeVolumes: true });
      await rm(configDir, { recursive: true, force: true });
    },
  };
}
