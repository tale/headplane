import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { machineAction } from "~/routes/machines/machine-actions";

import { HARNESS_LABEL } from "../../harness/headscale";
import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { waitFor } from "../../harness/wait";
import { statusOf, type TestApp } from "../../support/app";

const ALLOW_ALL = { acls: [{ action: "accept", src: ["*"], dst: ["*:*"] }] };

describe("machines on a real tailnet", () => {
  let tailnet: Tailnet;
  let app: TestApp;
  let owner: string;

  beforeAll(async () => {
    tailnet = await createTailnet({ policy: ALLOW_ALL });
    app = await tailnet.headplane();
    owner = (await app.signIn("owner")).cookie;
    await tailnet.user("alice@");
  });

  afterAll(async () => {
    await tailnet?.dispose();
  });

  function machine(form: Record<string, string>) {
    return app.call(machineAction as never, "/machines", { as: owner, form });
  }

  test("a waiting machine registered from its URL comes online for that user", async () => {
    const pending = await tailnet.pendingNode({ name: "laptop" });

    const result = await machine({
      intent: "register",
      register_key: pending.registerUrl,
      user: "alice@",
    });

    expect(statusOf(result)).toBe(302);
    const node = await pending.joined();
    expect((await node.machine()).user?.name).toBe("alice@");
  });

  test("peers see a machine by its new name after a rename", async () => {
    const web = await tailnet.node({ name: "web", user: "alice@" });
    const db = await tailnet.node({ name: "db", user: "alice@" });

    expect(statusOf(await machine({ intent: "rename", node_id: web.id, name: "frontend" }))).toBe(
      200,
    );

    await waitFor("db to see web as frontend", async () => {
      const peers = Object.values((await db.status()).Peer as Record<string, { DNSName: string }>);
      expect(peers.map((peer) => peer.DNSName)).toContain("frontend.tailnet.test.");
    });
  });

  test("peers can use a route once it's approved", async () => {
    const router = await tailnet.node({ name: "router", user: "alice@", routes: ["10.20.0.0/24"] });
    const client = await tailnet.node({ name: "client", user: "alice@" });

    const result = await machine({
      intent: "update_routes",
      node_id: router.id,
      routes: "10.20.0.0/24",
      enabled: "true",
    });

    expect(statusOf(result)).toBe(200);
    await waitFor("client to see the route", async () => {
      const peers = Object.values(
        (await client.status()).Peer as Record<
          string,
          { HostName: string; PrimaryRoutes?: string[] }
        >,
      );
      expect(peers.find((peer) => peer.HostName === "router")?.PrimaryRoutes).toEqual([
        "10.20.0.0/24",
      ]);
    });
  });
});

describe("DNS on a real tailnet", () => {
  let tailnet: Tailnet;

  beforeAll(async () => {
    tailnet = await createTailnet({ policy: ALLOW_ALL });
  });

  afterAll(async () => {
    await tailnet?.dispose();
  });

  test("a record added in Headplane restarts Headscale and reaches the machines", async () => {
    const { dnsAction } = await import("~/routes/dns/dns-actions");
    const app = await tailnet.headplane({
      config: {
        integration: {
          docker: {
            enabled: true,
            container_label: `${HARNESS_LABEL}=${tailnet.id}`,
            socket: process.env.DOCKER_HOST ?? "unix:///var/run/docker.sock",
          },
        },
      },
    });

    const node = await tailnet.node({ name: "dns-client", user: "alice@" });
    const { cookie } = await app.signIn("owner");
    const result = await app.call(dnsAction as never, "/dns", {
      as: cookie,
      form: {
        intent: "add_record",
        type: "A",
        name: "intranet.tailnet.test",
        value: "100.100.1.1",
      },
    });

    expect(statusOf(result)).toBe(200);
    await waitFor(
      "the record in the node's netmap",
      async () => {
        const netmap = await node.tailscale(["debug", "netmap"]);
        expect(netmap).toContain("intranet.tailnet.test");
      },
      { timeout: 60_000 },
    );
  });
});
