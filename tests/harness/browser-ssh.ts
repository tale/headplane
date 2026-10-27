import { join } from "node:path";

import tc from "testcontainers";

import { HARNESS_LABEL } from "./headscale";
import { NODE_IMAGE } from "./versions";

export interface BrowserSshSession {
  controlURL: string;
  authKey: string;
  hostname: string;
  host: string;
  user: string;
  // Typed into the terminal once it connects.
  input: string;
  timeoutMs?: number;
}

export interface BrowserSshResult {
  output: string;
  events: string[];
  error?: string;
}

interface Target {
  id: string;
  network: tc.StartedNetwork;
  caCert: string;
}

// A stand-in browser on the tailnet's network, running Browser SSH from the
// hp_ssh.wasm and wasm_exec.js built into `wasmDir`.
export async function startBrowser(target: Target, wasmDir: string) {
  const container = await new tc.GenericContainer(NODE_IMAGE)
    .withNetwork(target.network)
    .withLabels({ [`${HARNESS_LABEL}.browser`]: target.id })
    .withCommand(["sleep", "infinity"])
    .withEnvironment({ NODE_EXTRA_CA_CERTS: "/browser-ssh/ca.pem" })
    .withCopyFilesToContainer([
      { source: join(wasmDir, "hp_ssh.wasm"), target: "/browser-ssh/hp_ssh.wasm" },
      { source: join(wasmDir, "wasm_exec.js"), target: "/browser-ssh/wasm_exec.js" },
      {
        source: join(import.meta.dirname, "browser-ssh-client.ts"),
        target: "/browser-ssh/client.ts",
      },
    ])
    .withCopyContentToContainer([{ content: target.caCert, target: "/browser-ssh/ca.pem" }])
    .start();

  async function ssh(session: BrowserSshSession): Promise<BrowserSshResult> {
    // Go turns off fetch when argv0 says Node, and browsers always have it.
    const result = await container.exec(
      ["bash", "-c", "exec -a browser node /browser-ssh/client.ts"],
      {
        env: { BROWSER_SSH: JSON.stringify({ timeoutMs: 60_000, ...session }) },
      },
    );

    const line = result.stdout.split("\n").find((l) => l.startsWith("RESULT "));
    if (!line) {
      throw new Error(`Browser SSH printed no result:\n${result.output}`);
    }

    return JSON.parse(line.slice("RESULT ".length)) as BrowserSshResult;
  }

  // What the session's terminal has shown so far, while it's still open.
  async function output(hostname: string) {
    const result = await container.exec(["cat", `/tmp/${hostname}.out`]);
    return result.exitCode === 0 ? result.stdout : "";
  }

  return {
    ssh,
    output,
    async stop() {
      await container.stop({ remove: true });
    },
  };
}
