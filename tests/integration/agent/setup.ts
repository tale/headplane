import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    agentPath: string;
  }
}

let buildDir: string | undefined;

export async function setup(project: TestProject) {
  buildDir = await mkdtemp(join(tmpdir(), "hp-agent-bin-"));
  const agentPath = join(buildDir, "hp_agent");

  execFileSync("go", ["build", "-o", agentPath, "./cmd/hp_agent"], { stdio: "inherit" });
  project.provide("agentPath", agentPath);
}

export async function teardown() {
  if (buildDir) {
    await rm(buildDir, { recursive: true, force: true });
  }
}
