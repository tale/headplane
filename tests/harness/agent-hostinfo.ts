import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const [agentPath, overridesPath] = process.argv.slice(2);
const overrides: Record<string, object> = JSON.parse(readFileSync(overridesPath, "utf8"));

const agent = spawn(agentPath, [], { stdio: ["pipe", "pipe", "inherit"] });
process.stdin.pipe(agent.stdin);
agent.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => agent.kill(signal));
}

for await (const line of createInterface({ input: agent.stdout })) {
  const output = JSON.parse(line);
  for (const host of Object.values(output.hosts ?? {}) as Array<{ Hostname?: string }>) {
    Object.assign(host, overrides[host.Hostname ?? ""]);
  }

  process.stdout.write(`${JSON.stringify(output)}\n`);
}
