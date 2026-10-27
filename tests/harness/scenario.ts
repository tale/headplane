import type { NodeOptions } from "./node";
import type { Tailnet, TailnetOptions } from "./tailnet";

export interface Scenario {
  description: string;
  users: Array<{ name: string; email?: string; displayName?: string }>;
  // `approve` lists routes to approve once the node has joined. `expiresIn`
  // sets its key expiry in days, with 0 for already expired. `hostInfo` is
  // what the agent reports for it in the docs screenshots.
  nodes: Array<
    NodeOptions & {
      approve?: string[];
      expiresIn?: number;
      offline?: boolean;
      hostInfo?: { OS: string; OSVersion: string };
    }
  >;
  policy?: TailnetOptions["policy"];
  headscaleConfig?: TailnetOptions["headscaleConfig"];
  records?: TailnetOptions["records"];
}

// `serial` joins nodes one at a time, so their IDs and IPs follow the list.
// Returns the joined nodes by name.
export async function applyScenario(tailnet: Tailnet, scenario: Scenario, { serial = false } = {}) {
  for (const user of scenario.users) {
    await tailnet.user(user.name, { email: user.email, displayName: user.displayName });
  }

  if (scenario.policy) {
    await tailnet.setPolicy(scenario.policy);
  }

  async function join({ approve, expiresIn, offline, ...options }: Scenario["nodes"][number]) {
    const node = await tailnet.node(options);
    if (approve?.length) await tailnet.api.nodes.approveRoutes(node.id, approve);
    if (expiresIn !== undefined) await tailnet.setExpiry(node.id, expiresIn);
    if (offline) await node.down();
    return node;
  }

  if (!serial) {
    const nodes = await Promise.all(scenario.nodes.map(join));
    return Object.fromEntries(nodes.map((node) => [node.name, node]));
  }

  const nodes: Record<string, Awaited<ReturnType<typeof join>>> = {};
  for (const options of scenario.nodes) {
    nodes[options.name] = await join(options);
  }

  return nodes;
}
