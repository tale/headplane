import { expect, test } from "vitest";

import { applyScenario, type Scenario } from "../../harness/scenario";
import homelab from "../../harness/scenarios/homelab";
import minimal from "../../harness/scenarios/minimal";
import { createTailnet } from "../../harness/tailnet";

test.concurrent.for<[string, Scenario]>([
  ["homelab", homelab],
  ["minimal", minimal],
])("the %s scenario starts", async ([, scenario]) => {
  await using tailnet = await createTailnet({
    headscaleConfig: scenario.headscaleConfig,
    records: scenario.records,
  });
  await applyScenario(tailnet, scenario);

  const nodes = await tailnet.api.nodes.list();
  expect(nodes.map((node) => node.name).sort()).toEqual(
    scenario.nodes.map((node) => node.name).sort(),
  );

  for (const node of scenario.nodes) {
    const machine = nodes.find((n) => n.name === node.name)!;
    expect(machine.online, node.name).toBe(!node.offline);
  }
});
