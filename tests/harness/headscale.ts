import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import tc from "testcontainers";
import { stringify } from "yaml";

import type { HeadscaleVersion } from "./versions";

export const HARNESS_LABEL = "me.tale.headplane.harness";
const ALIAS = "headscale";
const CERT_DIR = join(tmpdir(), "headplane-harness-tls");

export type StartedHeadscale = Awaited<ReturnType<typeof startHeadscale>>;

export function headscaleConfig(overrides: Record<string, unknown> = {}) {
  return {
    server_url: `http://${ALIAS}:8080`,
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
    },
    unix_socket: "/var/run/headscale/headscale.sock",
    unix_socket_permission: "0770",
    logtail: { enabled: false },
    ...overrides,
  };
}

// Nodes retry control over TLS on 443 after a reconnect, so a tailnet's
// Headscale needs TLS. One self-signed pair is shared by every worker.
async function certificate() {
  const pairDir = join(CERT_DIR, "pair");
  if (!existsSync(pairDir)) {
    await mkdir(CERT_DIR, { recursive: true });
    const scratch = await mkdtemp(join(CERT_DIR, "new-"));
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "ec",
        "-pkeyopt",
        "ec_paramgen_curve:prime256v1",
        "-nodes",
        "-days",
        "3650",
        "-subj",
        `/CN=${ALIAS}`,
        "-addext",
        `subjectAltName=DNS:${ALIAS},DNS:localhost,IP:127.0.0.1`,
        "-keyout",
        join(scratch, "key.pem"),
        "-out",
        join(scratch, "cert.pem"),
      ],
      { stdio: "ignore" },
    );

    // Publishing the whole directory is atomic, so the first worker's pair
    // wins and parallel workers never mix a key with another's certificate.
    await rename(scratch, pairDir).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOTEMPTY" && error.code !== "EEXIST") {
        throw error;
      }

      await rm(scratch, { recursive: true, force: true });
    });
  }

  const certPath = join(pairDir, "cert.pem");
  const keyPath = join(pairDir, "key.pem");
  return {
    certPath,
    cert: await readFile(certPath, "utf8"),
    key: await readFile(keyPath, "utf8"),
  };
}

export async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function startHeadscale(options: {
  version: HeadscaleVersion;
  // Labels the container `${HARNESS_LABEL}=${id}`.
  id: string;
  network?: tc.StartedNetwork;
  // Merged over the defaults one top-level key at a time.
  config?: Record<string, unknown>;
  // Serves HTTPS on 443, as nodes need.
  tls?: boolean;
  records?: Array<{ name: string; type: string; value: string }>;
  // Puts Headscale's policy in `file` mode with this content.
  policyFile?: string;
}) {
  // Mounted rather than copied so Headplane can edit it like a real deployment.
  const configDir = await mkdtemp(join(tmpdir(), "hp-harness-headscale-"));
  const configPath = join(configDir, "config.yaml");
  const recordsPath = join(configDir, "extra-records.json");
  const tls = options.tls ? await certificate() : undefined;
  // Tailnets relay through Headscale's own DERP server rather than
  // Tailscale's, which browser clients reach over WebSockets.
  const listen = tls
    ? {
        server_url: `https://${ALIAS}`,
        listen_addr: "0.0.0.0:443",
        tls_cert_path: "/etc/headscale/tls.crt",
        tls_key_path: "/etc/headscale/tls.key",
        derp: {
          server: {
            enabled: true,
            region_id: 999,
            region_code: "headscale",
            region_name: "Headscale",
            stun_listen_addr: "0.0.0.0:3478",
            private_key_path: "/var/lib/headscale/derp_server_private.key",
            automatically_add_embedded_derp_region: true,
          },
          urls: [],
          paths: [],
          auto_update_enabled: false,
        },
      }
    : {};

  if (tls) {
    await writeFile(join(configDir, "tls.crt"), tls.cert, { mode: 0o644 });
    await writeFile(join(configDir, "tls.key"), tls.key, { mode: 0o644 });
  }

  if (options.policyFile !== undefined) {
    await writeFile(join(configDir, "policy.json"), options.policyFile, { mode: 0o644 });
  }

  // Headplane only edits DNS records kept in their own file.
  const config = headscaleConfig({
    ...listen,
    ...(options.policyFile !== undefined && {
      policy: { mode: "file", path: "/etc/headscale/policy.json" },
    }),
    ...options.config,
  });
  const dns = {
    ...(config.dns as object),
    extra_records_path: "/etc/headscale/extra-records.json",
  };
  await writeFile(recordsPath, JSON.stringify(options.records ?? []), { mode: 0o644 });
  await writeFile(configPath, stringify({ ...config, dns }), { mode: 0o644 });
  await chmod(configDir, 0o755);
  const containerPort = tls ? 443 : 8080;

  // A fixed host port survives restarts, which Headplane's Docker
  // integration does after editing the config.
  async function start(port: number) {
    let builder = new tc.GenericContainer(`headscale/headscale:${options.version}`)
      .withCommand(["serve"])
      .withExposedPorts({ container: containerPort, host: port })
      .withBindMounts([{ source: configDir, target: "/etc/headscale" }])
      .withLabels({ [HARNESS_LABEL]: options.id })
      .withWaitStrategy(
        tls
          ? tc.Wait.forHttp("/health", containerPort).usingTls().allowInsecure().forStatusCode(200)
          : tc.Wait.forHttp("/health", containerPort).forStatusCode(200),
      )
      .withStartupTimeout(30_000);

    if (options.network) {
      builder = builder.withNetwork(options.network).withNetworkAliases(ALIAS);
    }

    return builder.start();
  }

  // Another process can take the free port before Docker binds it.
  async function startOnFreePort() {
    for (let attempt = 1; ; attempt++) {
      const port = await freePort();
      try {
        return { port, container: await start(port) };
      } catch (error) {
        if (attempt === 3 || !String(error).includes("address already in use")) throw error;
      }
    }
  }

  const { port, container } = await startOnFreePort();

  async function createApiKey() {
    const result = await container.exec(["headscale", "apikeys", "create", "-o", "json"]);
    if (result.exitCode !== 0) {
      throw new Error(`headscale apikeys create failed:\n${result.output}`);
    }

    return JSON.parse(result.stdout) as string;
  }

  return {
    version: options.version,
    container,
    configPath,
    recordsPath,
    url: tls ? `https://localhost:${port}` : `http://${container.getHost()}:${port}`,
    controlUrl: tls ? `https://${ALIAS}` : `http://${ALIAS}:8080`,
    certPath: tls?.certPath,
    caCert: tls?.cert,
    createApiKey,
    apiKey: await createApiKey(),

    // Docker on macOS delivers a host write as one combined inotify event,
    // which Headscale's records watcher ignores. A write from inside Docker
    // arrives as separate events, so rewrite the file from there.
    async reloadRecords() {
      await container.copyFilesToContainer([
        { source: recordsPath, target: "/etc/headscale/extra-records.json" },
      ]);
    },

    async stop() {
      await container.stop({ remove: true, removeVolumes: true });
      await rm(configDir, { recursive: true, force: true });
    },
  };
}
