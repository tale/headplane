import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { stringify } from "yaml";

import { HARNESS_LABEL } from "./headscale";
import type { Tailnet } from "./tailnet";

export interface HeadplaneConfigOptions {
  port: number;
  server?: Record<string, unknown>;
  headscale?: Record<string, unknown>;
  integration?: Record<string, unknown>;
  oidc?: Record<string, unknown>;
}

export async function writeHeadplaneConfig(tailnet: Tailnet, options: HeadplaneConfigOptions) {
  const dataDir = await mkdtemp(join(tmpdir(), "hp-harness-headplane-"));
  const configPath = join(dataDir, "config.yaml");
  await writeFile(
    configPath,
    stringify({
      server: {
        host: "127.0.0.1",
        port: options.port,
        cookie_secret: randomBytes(16).toString("hex"),
        cookie_secure: false,
        data_path: dataDir,
        ...options.server,
      },
      headscale: {
        url: tailnet.server.url,
        api_key: tailnet.server.apiKey,
        tls_cert_path: tailnet.server.certPath,
        config_path: tailnet.server.configPath,
        dns_records_path: tailnet.server.recordsPath,
        ...options.headscale,
      },
      integration: {
        docker: {
          enabled: true,
          container_label: `${HARNESS_LABEL}=${tailnet.id}`,
          socket: process.env.DOCKER_HOST ?? "unix:///var/run/docker.sock",
        },
        ...options.integration,
      },
      oidc: options.oidc,
    }),
  );

  return configPath;
}

export function startHeadplane(
  configPath: string,
  port: number,
  { env = {}, isProduction = false }: { env?: NodeJS.ProcessEnv; isProduction?: boolean } = {},
) {
  const [command, args] = isProduction
    ? [process.execPath, ["build/server/index.js"]]
    : ["pnpm", ["exec", "react-router", "dev", "--port", String(port)]];

  return spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env, HEADPLANE_CONFIG_PATH: configPath },
  });
}
