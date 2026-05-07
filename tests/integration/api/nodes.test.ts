import { describe, expect, test } from "vitest";

import { getBootstrapClient, getNode, getRuntimeClient, HS_VERSIONS } from "../setup/env";

describe.sequential.for(HS_VERSIONS)("Headscale %s: Users", (version) => {
  let workingNodeId: string;

  test("nodes can register via their nodekey", async () => {
    const client = await getRuntimeClient(version);
    const tailnetNode = await getNode(version);

    const user = await client.users.create({ name: "node-reg@" });
    const node = await client.nodes.register(user.name, tailnetNode.authCode);
    expect(node).toBeDefined();
    expect(node.registerMethod).toBe("REGISTER_METHOD_CLI");
    expect(node.name).toBe(tailnetNode.nodeName);
  });

  test("nodes can be retrieved", async () => {
    const client = await getRuntimeClient(version);
    const { nodeName } = await getNode(version);
    const nodes = await client.nodes.list();
    const node = nodes.find((n) => n.name === nodeName);
    expect(node).toBeDefined();
    expect(node?.name).toBe(nodeName);

    const fetchedNode = await client.nodes.get(node!.id);
    expect(fetchedNode).toBeDefined();
    expect(fetchedNode.id).toBe(node!.id);
    workingNodeId = node!.id;
  });

  test("nodes can be renamed", async () => {
    const client = await getRuntimeClient(version);
    const { nodeName } = await getNode(version);
    const newName = `${nodeName}-renamed`;

    await client.nodes.rename(workingNodeId, newName);
    const renamedNode = await client.nodes.get(workingNodeId);
    expect(renamedNode).toBeDefined();
    expect(renamedNode.givenName).toBe(newName);
  });

  test("nodes can be reassigned to another user", async (context) => {
    const bootstrap = await getBootstrapClient(version);
    // Reassigning a node owner was removed in 0.28.
    if (bootstrap.capabilities.nodeOwnerIsImmutable) {
      context.skip();
    }

    const client = await getRuntimeClient(version);
    const user = await client.users.create({ name: "node-reassign@" });

    // reassignUser is only defined on pre-0.28 clients, hence the guard above.
    await client.nodes.reassignUser!(workingNodeId, user.id);
    const reassignedNode = await client.nodes.get(workingNodeId);
    expect(reassignedNode).toBeDefined();
    expect(reassignedNode.user?.name).toBe(user.name);
  });

  test("nodes can be expired", async () => {
    const client = await getRuntimeClient(version);
    await client.nodes.expire(workingNodeId);

    const expiredNode = await client.nodes.get(workingNodeId);
    expect(expiredNode).toBeDefined();
    expect(expiredNode.expiry).toBeDefined();
  });

  test("key expiry of nodes can be toggled", async () => {
    const client = await getRuntimeClient(version);
    await client.toggleExpiry(workingNodeId, true);

    const permanentNode = await client.getNode(workingNodeId);
    expect(permanentNode).toBeDefined();
    expect(permanentNode.expiry).toBeNull();

    await client.toggleExpiry(workingNodeId, false);

    const node = await client.getNode(workingNodeId);
    expect(node).toBeDefined();
    expect(node.expiry).not.toBeNull();
  });

  test("nodes can be deleted", async () => {
    const client = await getRuntimeClient(version);
    await client.nodes.delete(workingNodeId);

    const nodes = await client.nodes.list();
    const node = nodes.find((n) => n.id === workingNodeId);
    expect(node).toBeUndefined();
  });
});
