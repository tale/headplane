import tc, { getContainerRuntimeClient } from "testcontainers";

import type { HeadscaleClient } from "~/server/headscale/api";

import { HARNESS_LABEL } from "./headscale";
import { TAILSCALE_IMAGE } from "./versions";
import { waitFor } from "./wait";

export interface NodeOptions {
  name: string;
  user?: string;
  tags?: string[];
  ssh?: boolean;
  routes?: string[];
  exitNode?: boolean;
  tailscaleVersion?: string;
}

// The tailnet a node joins.
interface Target {
  id: string;
  network: tc.StartedNetwork;
  api: HeadscaleClient;
  controlUrl: string;
  // Trusted by tailscaled so it can reach Headscale over HTTPS.
  caCert: string;
}

const SOCKET = "/var/run/tailscale/tailscaled.sock";

// Tags ride on the auth key when there is one, which skips tagOwners checks.
function upArgs(target: Target, options: NodeOptions, authKey?: string) {
  const args = [
    `--login-server=${target.controlUrl}`,
    `--hostname=${options.name}`,
    "--accept-dns=false",
  ];

  if (authKey) args.push(`--auth-key=${authKey}`);
  if (options.ssh) args.push("--ssh");
  if (options.exitNode) args.push("--advertise-exit-node");
  if (options.routes?.length) args.push(`--advertise-routes=${options.routes.join(",")}`);
  if (!authKey && options.tags?.length) {
    args.push(`--advertise-tags=${options.tags.join(",")}`);
  }

  return args;
}

async function startDaemon(target: Target, options: NodeOptions) {
  const image = options.tailscaleVersion
    ? `tailscale/tailscale:v${options.tailscaleVersion}`
    : TAILSCALE_IMAGE;

  const container = await new tc.GenericContainer(image)
    .withNetwork(target.network)
    .withName(`hp-harness-${target.id}-${options.name}`)
    .withHostname(options.name)
    .withLabels({ [`${HARNESS_LABEL}.node`]: target.id })
    .withEntrypoint(["tailscaled"])
    .withCommand([
      "--tun=userspace-networking",
      "--statedir=/var/lib/tailscale",
      `--socket=${SOCKET}`,
    ])
    .withEnvironment({ SSL_CERT_FILE: "/etc/ssl/harness.pem" })
    .withCopyContentToContainer([{ content: target.caCert, target: "/etc/ssl/harness.pem" }])
    .withStartupTimeout(30_000)
    .start();

  async function exec(args: string[]) {
    const result = await container.exec(args);
    if (result.exitCode !== 0) {
      throw new Error(`${args.join(" ")} failed:\n${result.output}`);
    }

    return result.stdout;
  }

  const tailscale = (args: string[]) => exec(["tailscale", `--socket=${SOCKET}`, ...args]);
  await waitFor(`tailscaled on ${options.name}`, () => tailscale(["status", "--json"]), {
    interval: 100,
  });

  return { container, exec, tailscale };
}

async function waitForNode(target: Target, name: string, online = true) {
  return waitFor(`${name} to be ${online ? "online" : "offline"}`, async () => {
    const node = (await target.api.nodes.list()).find((n) => n.name === name);
    if (!node) throw new Error(`${name} isn't registered`);
    if (node.online !== online) throw new Error(`online=${node.online}`);
    return node;
  });
}

export async function startNode(target: Target, options: NodeOptions, authKey: string) {
  const daemon = await startDaemon(target, options);
  try {
    await daemon.tailscale(["up", ...upArgs(target, options, authKey)]);
    const machine = await waitForNode(target, options.name);
    return nodeHandle(target, daemon, machine.id, options.name);
  } catch (error) {
    await daemon.container.stop({ remove: true, removeVolumes: true });
    throw error;
  }
}

// Resolves with the register URL a node without an auth key prints.
export async function startPendingNode(target: Target, options: NodeOptions) {
  const daemon = await startDaemon(target, options);
  const command = ["tailscale", `--socket=${SOCKET}`, "up", ...upArgs(target, options)].join(" ");
  await daemon.exec(["sh", "-c", `${command} > /tmp/up.log 2>&1 &`]);

  const pattern = new RegExp(`${target.controlUrl}/register/\\S+`);
  const registerUrl = await waitFor("a registration URL", async () => {
    const match = (await daemon.exec(["cat", "/tmp/up.log"])).match(pattern);
    if (!match) throw new Error("not printed yet");
    return match[0];
  });

  return {
    name: options.name,
    registerUrl,
    async joined() {
      const machine = await waitForNode(target, options.name);
      return nodeHandle(target, daemon, machine.id, options.name);
    },
    async stop() {
      await daemon.container.stop({ remove: true, removeVolumes: true });
    },
  };
}

function nodeHandle(
  target: Target,
  daemon: Awaited<ReturnType<typeof startDaemon>>,
  id: string,
  name: string,
) {
  return {
    id,
    name,
    exec: daemon.exec,
    tailscale: daemon.tailscale,
    copyFiles: (files: Array<{ source: string; target: string; mode?: number }>) =>
      daemon.container.copyFilesToContainer(files),

    machine() {
      return target.api.nodes.get(id);
    },

    async status() {
      return JSON.parse(await daemon.tailscale(["status", "--json"])) as Record<string, unknown>;
    },

    // Stops the container, like a machine that's switched off.
    async down() {
      const client = await getContainerRuntimeClient();
      await client.container.stop(client.container.getById(daemon.container.getId()), {
        timeout: 5,
      });
      await waitForNode(target, name, false);
    },

    async up() {
      const client = await getContainerRuntimeClient();
      await client.container.start(client.container.getById(daemon.container.getId()));
      await waitForNode(target, name, true);
    },

    async stop() {
      await daemon.container.stop({ remove: true, removeVolumes: true });
    },
  };
}
