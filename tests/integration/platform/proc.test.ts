import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import tc from "testcontainers";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

// This is a little shim file that we use to execute the real proc-helper that
// is bundled through Vite in order to test against a real Linux /proc FS.
const testRunner = `
const { findHeadscaleServe } = require("./proc-helper.js");

async function main() {
  const pid = await findHeadscaleServe();
  console.log(JSON.stringify({
    pid,
    found: typeof pid === "number" && pid > 0,
  }));
}

main().catch((e) => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
`;

const root = fileURLToPath(new URL("../../..", import.meta.url));
const procHelper = join(root, "app/server/config/integration/proc-helper.ts");
const appDir = join(root, "app");

describe("ProcIntegration", () => {
  let container: tc.StartedTestContainer;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "headplane-proc-test-"));
    const bundlePath = join(tmpDir, "proc-helper.js");

    await build({
      configFile: false,
      logLevel: "silent",
      build: {
        lib: {
          entry: procHelper,
          formats: ["cjs"],
          fileName: () => "proc-helper.js",
        },
        outDir: tmpDir,
        emptyOutDir: false,
        rollupOptions: {
          external: (id) => id.startsWith("node:"),
        },
      },
      resolve: {
        alias: { "~": appDir },
      },
    });

    const runnerPath = join(tmpDir, "test-runner.js");
    await writeFile(runnerPath, testRunner);

    // Build a container image that has both headscale and Node.js using
    // a multi-stage Dockerfile. The headscale image is distroless (no shell)
    // so we pull the binary into node:alpine via COPY --from.
    await writeFile(
      join(tmpDir, "Dockerfile"),
      [
        "FROM headscale/headscale:0.25.1-debug AS headscale",
        "FROM node:24-alpine",
        "COPY --from=headscale /ko-app/headscale /usr/local/bin/headscale",
      ].join("\n"),
    );

    const configPath = join(root, "tests/integration/setup/config.yaml");
    const image = await tc.GenericContainer.fromDockerfile(tmpDir).build();

    container = await image
      .withCopyFilesToContainer([
        { source: configPath, target: "/etc/headscale/config.yaml" },
        { source: bundlePath, target: "/test/proc-helper.js" },
        { source: runnerPath, target: "/test/test-runner.js" },
      ])
      .withCommand(["sh", "-c", "headscale serve & sleep 2 && sleep infinity"])
      .withWaitStrategy(tc.Wait.forLogMessage("headscale", 1).withStartupTimeout(30_000))
      .start();
  }, 120_000);

  afterAll(async () => {
    await container?.stop({ remove: true, removeVolumes: true });
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("findHeadscaleServe finds the real headscale process", async () => {
    const result = await container.exec(["node", "/test/test-runner.js"]);
    const output = JSON.parse(result.stdout.trim());

    expect(result.exitCode).toBe(0);
    expect(output.found).toBe(true);
    expect(output.pid).toBeGreaterThan(0);
  });
});
