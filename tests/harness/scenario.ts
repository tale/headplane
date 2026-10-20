import type { NodeOptions } from "./node";
import type { Tailnet, TailnetOptions } from "./tailnet";

export interface Scenario {
  description: string;
  users: Array<{ name: string; email?: string; displayName?: string }>;
  // `approve` lists routes to approve once the node has joined.
  nodes: Array<NodeOptions & { approve?: string[]; offline?: boolean }>;
  policy?: TailnetOptions["policy"];
  headscaleConfig?: TailnetOptions["headscaleConfig"];
  records?: TailnetOptions["records"];
}

export async function applyScenario(tailnet: Tailnet, scenario: Scenario) {
  for (const user of scenario.users) {
    await tailnet.user(user.name, { email: user.email, displayName: user.displayName });
  }

  if (scenario.policy) {
    await tailnet.setPolicy(scenario.policy);
  }

  await Promise.all(
    scenario.nodes.map(async ({ approve, offline, ...options }) => {
      const node = await tailnet.node(options);
      if (approve?.length) await tailnet.api.nodes.approveRoutes(node.id, approve);
      if (offline) await node.down();
    }),
  );
}
