import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createTailnet, type Tailnet } from "../../harness/tailnet";

describe("harness tailnet", () => {
  let tailnet: Tailnet;

  beforeAll(async () => {
    tailnet = await createTailnet();
  });

  afterAll(async () => {
    await tailnet?.dispose();
  });

  test("nodes join with auth keys and can go offline and back", async () => {
    const web = await tailnet.node({ name: "web", user: "alice@", ssh: true });
    const db = await tailnet.node({ name: "db", tags: ["tag:db"] });

    const nodes = await tailnet.api.nodes.list();
    expect(nodes.map((n) => n.name).sort()).toEqual(["db", "web"]);
    expect((await db.machine()).tags).toEqual(["tag:db"]);

    await web.down();
    expect((await web.machine()).online).toBe(false);

    await web.up();
    expect((await web.machine()).online).toBe(true);
  });
});
