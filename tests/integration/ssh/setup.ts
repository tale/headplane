import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    sshWasmDir: string;
    sshAgentPath: string;
  }
}

let buildDir: string | undefined;

// Builds Browser SSH the way releases do, with the agent it requires.
export async function setup(project: TestProject) {
  buildDir = await mkdtemp(join(tmpdir(), "hp-ssh-bin-"));
  const agentPath = join(buildDir, "hp_agent");

  execFileSync("./build.sh", ["--wasm", "--wasm-output", join(buildDir, "hp_ssh.wasm")], {
    stdio: "inherit",
  });
  execFileSync("go", ["build", "-o", agentPath, "./cmd/hp_agent"], { stdio: "inherit" });

  project.provide("sshWasmDir", buildDir);
  project.provide("sshAgentPath", agentPath);
}

export async function teardown() {
  if (buildDir) {
    await rm(buildDir, { recursive: true, force: true });
  }
}
