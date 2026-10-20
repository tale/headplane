import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { loader as machineLoader } from "~/routes/machines/machine";
import { machineAction } from "~/routes/machines/machine-actions";
import { loader as machinesLoader } from "~/routes/machines/overview";
import type { Machine } from "~/types";
import type { ActionResult } from "~/utils/form";

import { createTailnet, type Tailnet } from "../../harness/tailnet";
import { testedVersions } from "../../harness/versions";
import { waitFor } from "../../harness/wait";
import { statusOf, type TestApp } from "../../support/app";

const ALLOW_ALL_ACL_POLICY = { acls: [{ action: "accept", src: ["*"], dst: ["*:*"] }] };

describe("machines on a real tailnet", () => {
  let tailnet: Tailnet;
  let app: TestApp;
  let owner: string;

  beforeAll(async () => {
    tailnet = await createTailnet({ policy: ALLOW_ALL_ACL_POLICY });
    app = await tailnet.headplane();
    owner = (await app.signIn("owner")).cookie;
    await tailnet.user("alice@");
  });

  afterAll(async () => {
    await tailnet?.dispose();
  });

  function machine(form: Record<string, string | string[]>) {
    return app.call(machineAction, "/machines", { as: owner, form });
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
      expect((await peer(client, "router"))?.PrimaryRoutes).toEqual(["10.20.0.0/24"]);
    });
  });

  test("peers can use an exit node once it's approved, and its subnet survives turning it off", async () => {
    const exit = await tailnet.node({
      name: "exit",
      user: "alice@",
      exitNode: true,
      routes: ["10.30.0.0/24"],
    });
    const client = await tailnet.node({ name: "traveler", user: "alice@" });
    const routes = ["0.0.0.0/0", "::/0", "10.30.0.0/24"];

    expect(
      statusOf(
        await machine({ intent: "update_routes", node_id: exit.id, routes, enabled: "true" }),
      ),
    ).toBe(200);
    await waitFor("traveler to be offered the exit node", async () => {
      expect((await peer(client, "exit"))?.ExitNodeOption).toBe(true);
    });

    const result = await machine({
      intent: "update_routes",
      node_id: exit.id,
      routes: ["0.0.0.0/0", "::/0"],
      enabled: "false",
    });

    expect(statusOf(result)).toBe(200);
    await waitFor("traveler to lose the exit node", async () => {
      const seen = await peer(client, "exit");
      expect(seen?.ExitNodeOption).toBeFalsy();
      expect(seen?.PrimaryRoutes).toEqual(["10.30.0.0/24"]);
    });
  });

  test("a deleted machine is gone and its node is signed out", async () => {
    const node = await tailnet.node({ name: "retired", user: "alice@" });

    const result = await machine({ intent: "delete", node_id: node.id });
    expect((result as Response).headers.get("Location")).toBe("/machines");
    expect((await tailnet.api.nodes.list()).map((n) => n.id)).not.toContain(node.id);
    await waitFor("the node to be signed out", async () => {
      expect((await node.status()).BackendState).toBe("NeedsLogin");
    });
  });

  test("an expired machine is signed out", async () => {
    const node = await tailnet.node({ name: "stale", user: "alice@" });

    expect(statusOf(await machine({ intent: "expire", node_id: node.id }))).toBe(200);
    await waitFor("the node to be signed out", async () => {
      expect((await node.status()).BackendState).toBe("NeedsLogin");
    });
  });

  test("acting on a machine that's gone says so", async () => {
    const node = await tailnet.node({ name: "ghost", user: "alice@" });
    await tailnet.api.nodes.delete(node.id);

    const result = await machine({ intent: "rename", node_id: node.id, name: "boo" });
    expect(statusOf(result)).toBe(404);
    expect(formError(result)).toBe("This machine no longer exists.");
  });
});

describe("machine tags on a real tailnet", () => {
  let tailnet: Tailnet;
  let app: TestApp;
  let owner: string;

  beforeAll(async () => {
    tailnet = await createTailnet({
      policy: {
        tagOwners: { "tag:server": [] },
        acls: [{ action: "accept", src: ["*"], dst: ["tag:server:*"] }],
      },
    });
    app = await tailnet.headplane();
    owner = (await app.signIn("owner")).cookie;
  });

  afterAll(async () => {
    await tailnet?.dispose();
  });

  function machine(form: Record<string, string | string[]>) {
    return app.call(machineAction, "/machines", { as: owner, form });
  }

  test("a tag lets the machines its rules allow reach the node", async () => {
    const server = await tailnet.node({ name: "server", user: "alice@" });
    const laptop = await tailnet.node({ name: "laptop", user: "alice@" });
    expect(await peer(laptop, "server")).toBeUndefined();

    const result = await machine({
      intent: "update_tags",
      node_id: server.id,
      tags: [" tag:server ", ""],
    });

    expect(statusOf(result)).toBe(200);
    expect((await server.machine()).tags).toEqual(["tag:server"]);
    await waitFor("laptop to see server", async () => {
      expect(await peer(laptop, "server")).toBeDefined();
    });
  });

  test("a tag Headscale rejects is reported and changes nothing", async () => {
    const node = await tailnet.node({ name: "untagged", user: "alice@" });

    const result = await machine({ intent: "update_tags", node_id: node.id, tags: "server" });

    expect(statusOf(result)).toBe(400);
    expect(formError(result)).toBe("Tag must start with the string 'tag:'");
    expect((await node.machine()).tags).toEqual([]);
  });
});

describe.for(testedVersions())("machine owners and expiry on Headscale %s", (version) => {
  const ownersAreImmutable = version !== "0.27.1";
  const canDisableExpiry = version === "0.29.5";
  let tailnet: Tailnet;
  let app: TestApp;
  let owner: string;

  beforeAll(async () => {
    tailnet = await createTailnet({ version });
    app = await tailnet.headplane();
    owner = (await app.signIn("owner")).cookie;
  });

  afterAll(async () => {
    await tailnet?.dispose();
  });

  function machine(form: Record<string, string>) {
    return app.call(machineAction, "/machines", { as: owner, form });
  }

  test(`moving a machine to another user ${ownersAreImmutable ? "is refused" : "changes its owner"}`, async () => {
    const node = await tailnet.node({ name: "handed-down", user: "alice@" });
    const bob = await tailnet.user("bob@");

    const result = await machine({ intent: "reassign", node_id: node.id, user_id: bob.id });

    if (ownersAreImmutable) {
      expect(formError(result)).toBe(
        "Changing a machine's owner isn't supported on this Headscale version.",
      );
      expect((await node.machine()).user?.name).toBe("alice@");
      return;
    }

    expect(statusOf(result)).toBe(200);
    expect((await node.machine()).user?.name).toBe("bob@");
  });

  test(`turning key expiry off ${canDisableExpiry ? "keeps the machine signed in" : "is refused"}`, async () => {
    const node = await tailnet.node({ name: "forever", user: "alice@" });

    const result = await machine({
      intent: "toggle_expiry",
      node_id: node.id,
      disable_expiry: "true",
    });

    if (canDisableExpiry) {
      expect(statusOf(result)).toBe(200);
      expect((await node.machine()).expiry).toBeNull();
    } else {
      expect(formError(result)).toBe("Turning off key expiry needs Headscale 0.29 or newer.");
    }

    expect((await node.status()).BackendState).toBe("Running");
  });

  test("the list and the machine page agree on who owns a tagged machine", async () => {
    const node = await tailnet.node({ name: "tagged", user: "alice@", tags: ["tag:db"] });

    // Headplane polls Headscale, so a new machine shows up within seconds.
    const listed = await waitFor("the machine in the list", async () => {
      const list = (await app.call(machinesLoader, "/machines", { as: owner })) as {
        nodes: Machine[];
      };
      const found = list.nodes.find((n) => n.id === node.id);
      expect(found).toBeDefined();
      return found!;
    });
    const page = (await app.call(machineLoader, `/machines/${node.id}`, {
      as: owner,
      params: { id: node.id },
    })) as { node: Machine };

    expect(listed.user?.name).toBe(ownersAreImmutable ? "tagged-devices" : "alice@");
    expect(page.node.user?.name).toBe(listed.user?.name);
    expect(page.node.tags).toEqual(["tag:db"]);
  });

  test("a machine that doesn't exist is a 404", async () => {
    const result = await app.call(machineLoader, "/machines/9999", {
      as: owner,
      params: { id: "9999" },
    });

    expect(statusOf(result)).toBe(404);
  });
});

interface Peer {
  HostName: string;
  PrimaryRoutes?: string[];
  ExitNodeOption?: boolean;
}

async function peer(node: { status(): Promise<Record<string, unknown>> }, hostName: string) {
  const peers = Object.values(((await node.status()).Peer ?? {}) as Record<string, Peer>);
  return peers.find((p) => p.HostName === hostName);
}

function formError(result: unknown) {
  const { data } = result as { data: ActionResult };
  return data.ok ? undefined : data.errors.form;
}
