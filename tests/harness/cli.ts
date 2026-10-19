// pnpm harness up [scenario] [--version 0.29.5] [--headplane] | pnpm harness list

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";

import { stringify } from "yaml";

import { HARNESS_LABEL } from "./constants";
import { applyScenario, type Scenario } from "./scenario";
import { createTailnet } from "./tailnet";
import { HEADSCALE_VERSIONS, type HeadscaleVersion, LATEST_HEADSCALE } from "./versions";

const scenariosDir = join(import.meta.dirname, "scenarios");

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    version: { type: "string", default: LATEST_HEADSCALE },
    headplane: { type: "boolean", default: false },
    port: { type: "string", default: "3001" },
  },
});

const [command = "up", name = "homelab"] = positionals;

async function loadScenario(scenario: string): Promise<Scenario> {
  const module = await import(join(scenariosDir, `${scenario}.ts`)).catch(() => undefined);
  if (!module) {
    throw new Error(`No scenario named ${scenario}. Run \`pnpm harness list\` to see them.`);
  }

  return module.default;
}

if (command === "list") {
  for (const file of (await readdir(scenariosDir)).sort()) {
    const scenario = await loadScenario(basename(file, ".ts"));
    console.log(`${basename(file, ".ts").padEnd(12)} ${scenario.description}`);
  }

  process.exit(0);
}

if (command !== "up") {
  console.error(`Unknown command ${command}. Use \`up\` or \`list\`.`);
  process.exit(1);
}

const version = values.version as HeadscaleVersion;
if (!HEADSCALE_VERSIONS.includes(version)) {
  console.error(
    `Headscale ${version} isn't supported. Pick one of ${HEADSCALE_VERSIONS.join(", ")}.`,
  );
  process.exit(1);
}

const scenario = await loadScenario(name);
console.log(`Starting ${name} on Headscale ${version}: ${scenario.description}`);

const tailnet = await createTailnet({ version, headscaleConfig: scenario.headscaleConfig });
let headplane: ReturnType<typeof spawn> | undefined;

async function shutdown() {
  console.log("\nStopping the tailnet...");
  headplane?.kill("SIGTERM");
  await tailnet.dispose();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await applyScenario(tailnet, scenario);

const dataDir = await mkdtemp(join(tmpdir(), "hp-harness-headplane-"));
const configPath = join(dataDir, "config.yaml");
await writeFile(
  configPath,
  stringify({
    server: {
      host: "127.0.0.1",
      port: Number(values.port),
      cookie_secret: randomBytes(16).toString("hex"),
      cookie_secure: false,
      data_path: dataDir,
    },
    headscale: {
      url: tailnet.headscale.url,
      api_key: tailnet.headscale.apiKey,
      tls_cert_path: tailnet.headscale.certPath,
      config_path: tailnet.headscale.configPath,
    },
    integration: {
      docker: {
        enabled: true,
        container_label: `${HARNESS_LABEL}=${tailnet.id}`,
        socket: process.env.DOCKER_HOST ?? "unix:///var/run/docker.sock",
      },
    },
  }),
);

console.log(`
Headscale    ${tailnet.headscale.url}
API key      ${tailnet.headscale.apiKey}
CA cert      ${tailnet.headscale.certPath}
Config       ${tailnet.headscale.configPath}
Headplane    ${configPath}
Exec         docker exec ${tailnet.headscale.container.getId().slice(0, 12)} headscale <command>
`);

if (values.headplane) {
  headplane = spawn("pnpm", ["exec", "react-router", "dev", "--port", values.port!], {
    stdio: "inherit",
    env: { ...process.env, HEADPLANE_CONFIG_PATH: configPath },
  });

  console.log(`Headplane    http://127.0.0.1:${values.port}/admin (sign in with the API key)\n`);
} else {
  console.log(`Run Headplane against it with:
  HEADPLANE_CONFIG_PATH=${configPath} pnpm exec react-router dev --port ${values.port}
`);
}

console.log("Press Ctrl-C to stop.");
