// pnpm harness up [scenario] [--version 0.29.5] [--headplane] | pnpm harness list
// pnpm harness screenshots [--version 0.29.5]

import type { ChildProcess } from "node:child_process";
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";

import { startHeadplane, writeHeadplaneConfig } from "./headplane";
import { applyScenario, type Scenario } from "./scenario";
import { takeScreenshots } from "./screenshots";
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

if (command !== "up" && command !== "screenshots") {
  console.error(`Unknown command ${command}. Use \`up\`, \`list\` or \`screenshots\`.`);
  process.exit(1);
}

const version = values.version as HeadscaleVersion;
if (!HEADSCALE_VERSIONS.includes(version)) {
  console.error(
    `Headscale ${version} isn't supported. Pick one of ${HEADSCALE_VERSIONS.join(", ")}.`,
  );
  process.exit(1);
}

if (command === "screenshots") {
  await takeScreenshots(version, Number(values.port));
  process.exit(0);
}

const scenario = await loadScenario(name);
console.log(`Starting ${name} on Headscale ${version}: ${scenario.description}`);

const tailnet = await createTailnet({
  version,
  headscaleConfig: scenario.headscaleConfig,
  records: scenario.records,
});
let headplane: ChildProcess | undefined;

async function shutdown() {
  console.log("\nStopping the tailnet...");
  headplane?.kill("SIGTERM");
  await tailnet.dispose();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await applyScenario(tailnet, scenario);

const configPath = await writeHeadplaneConfig(tailnet, { port: Number(values.port) });

console.log(`
Headscale    ${tailnet.server.url}
API key      ${tailnet.server.apiKey}
CA cert      ${tailnet.server.certPath}
Config       ${tailnet.server.configPath}
Headplane    ${configPath}
Exec         docker exec ${tailnet.server.container.getId().slice(0, 12)} headscale <command>
`);

if (values.headplane) {
  headplane = startHeadplane(configPath, Number(values.port));

  console.log(`Headplane    http://127.0.0.1:${values.port}/admin (sign in with the API key)\n`);
} else {
  console.log(`Run Headplane against it with:
  HEADPLANE_CONFIG_PATH=${configPath} pnpm exec react-router dev --port ${values.port}
`);
}

console.log("Press Ctrl-C to stop.");
