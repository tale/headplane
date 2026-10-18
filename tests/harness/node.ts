import tc, { getContainerRuntimeClient } from "testcontainers";

import type { HeadscaleClient } from "~/server/headscale/api";

import { HARNESS_LABEL, HEADSCALE_ALIAS } from "./headscale";
import { TAILSCALE_IMAGE } from "./versions";
import { waitFor } from "./wait";

export interface NodeOptions {
  name: string;
  // Owning Headscale user. Tag-only nodes leave this unset (0.28+).
  user?: string;
  tags?: string[];
  ssh?: boolean;
  routes?: string[];
  exitNode?: boolean;
  ephemeral?: boolean;
}

export type TailnetNode = Awaited<ReturnType<typeof startNode>>;

interface StartNodeOptions extends NodeOptions {
  id: string;
  network: tc.StartedNetwork;
  api: HeadscaleClient;
  // Omitted to have the node wait for interactive registration.
  authKey?: string;
}

const SOCKET = "/var/run/tailscale/tailscaled.sock";

// Tags ride on the auth key when there is one, which skips tagOwners checks.
function upArgs(options: StartNodeOptions) {
  const args = [
    `--login-server=http://${HEADSCALE_ALIAS}:8080`,
    `--hostname=${options.name}`,
    "--accept-dns=false",
  ];

  if (options.ssh) args.push("--ssh");
  if (options.exitNode) args.push("--advertise-exit-node");
  if (options.routes?.length) args.push(`--advertise-routes=${options.routes.join(",")}`);
  if (!options.authKey && options.tags?.length) {
    args.push(`--advertise-tags=${options.tags.join(",")}`);
  }

  return args;
}

async function startDaemon(options: StartNodeOptions) {
  // Runs tailscaled directly instead of containerboot, which exits on
  // `tailscale down` and so can't model a node going offline.
  const container = await new tc.GenericContainer(TAILSCALE_IMAGE)
    .withNetwork(options.network)
    .withName(`hp-harness-${options.id}-${options.name}`)
    .withLabels({ [HARNESS_LABEL]: options.id })
    .withEntrypoint(["tailscaled"])
    .withCommand([
      "--tun=userspace-networking",
      "--statedir=/var/lib/tailscale",
      `--socket=${SOCKET}`,
    ])
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

async function waitForNode(options: StartNodeOptions, online = true) {
  return waitFor(`${options.name} to be ${online ? "online" : "offline"}`, async () => {
    const node = (await options.api.nodes.list()).find((n) => n.name === options.name);
    if (!node) throw new Error(`${options.name} isn't registered`);
    if (node.online !== online) throw new Error(`online=${node.online}`);
    return node;
  });
}

export async function startNode(options: StartNodeOptions) {
  const daemon = await startDaemon(options);
  await daemon.tailscale(["up", `--auth-key=${options.authKey}`, ...upArgs(options)]);
  const machine = await waitForNode(options);
  return nodeHandle(daemon, machine.id, options);
}

// Starts a node without an auth key and resolves with the URL it prints for
// interactive registration, as a user would see it.
export async function startPendingNode(options: StartNodeOptions) {
  const daemon = await startDaemon(options);
  const command = ["tailscale", `--socket=${SOCKET}`, "up", ...upArgs(options)].join(" ");
  await daemon.exec(["sh", "-c", `${command} > /tmp/up.log 2>&1 &`]);

  const pattern = new RegExp(`http://${HEADSCALE_ALIAS}:8080/register/\\S+`);
  const registerUrl = await waitFor("a registration URL", async () => {
    const match = (await daemon.exec(["cat", "/tmp/up.log"])).match(pattern);
    if (!match) throw new Error("not printed yet");
    return match[0];
  });

  return {
    name: options.name,
    container: daemon.container,
    registerUrl,
    async joined() {
      const machine = await waitForNode(options);
      return nodeHandle(daemon, machine.id, options);
    },
  };
}

function nodeHandle(
  daemon: Awaited<ReturnType<typeof startDaemon>>,
  id: string,
  options: StartNodeOptions,
) {
  return {
    id,
    name: options.name,
    container: daemon.container,
    exec: daemon.exec,
    tailscale: daemon.tailscale,

    machine() {
      return options.api.nodes.get(id);
    },

    async status() {
      return JSON.parse(await daemon.tailscale(["status", "--json"])) as Record<string, unknown>;
    },

    // Stops tailscaled rather than running `tailscale down`: a quick
    // down/up makes the client retry control over TLS on 443, which a
    // plain HTTP Headscale can't answer.
    async down() {
      const client = await getContainerRuntimeClient();
      await client.container.stop(client.container.getById(daemon.container.getId()), {
        timeout: 5,
      });
      await waitForNode(options, false);
    },

    async up() {
      const client = await getContainerRuntimeClient();
      await client.container.start(client.container.getById(daemon.container.getId()));
      await waitForNode(options, true);
    },

    async stop() {
      await daemon.container.stop({ remove: true, removeVolumes: true });
    },
  };
}
