import { RouterContextProvider } from "react-router";
import { describe, expect, test, vi } from "vitest";

import { machineAction } from "~/routes/machines/machine-actions";
import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { Capabilities } from "~/server/web/roles";

import { getBootstrapClient, getNode, getRuntimeClient, HS_VERSIONS } from "../setup/env";

function registerRequest(registerKey: string) {
  const form = new FormData();
  form.set("action_id", "register");
  form.set("register_key", registerKey);
  form.set("user", "node-reg@");

  return new Request("http://headplane.test/machines", {
    method: "POST",
    body: form,
  });
}

function actionContext(api: Awaited<ReturnType<typeof getRuntimeClient>>) {
  const auth = { can: vi.fn(() => true) };
  const liveStore = { refresh: vi.fn() };
  const principal = { id: "integration-user" };
  const context = new RouterContextProvider();

  context.set(authContext, auth as never);
  context.set(headscaleLiveStoreContext, liveStore as never);
  context.set(requestApiContext, vi.fn(async () => ({ principal, api })) as never);

  return { auth, context, liveStore };
}

describe.sequential.for(HS_VERSIONS)("Headscale %s: Users", (version) => {
  let workingNodeId: string;

  test("nodes can register from a Tailscale registration URL", async () => {
    const client = await getRuntimeClient(version);
    const tailnetNode = await getNode(version);
    const { auth, context, liveStore } = actionContext(client);

    const user = await client.users.create({ name: "node-reg@" });
    expect(user.name).toBe("node-reg@");

    const response = await machineAction({
      request: registerRequest(tailnetNode.registerUrl),
      context,
      params: {},
    } as never);

    expect(auth.can).toHaveBeenCalledWith(expect.anything(), Capabilities.write_machines);
    expect(liveStore.refresh).toHaveBeenCalledOnce();
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);

    const nodes = await client.nodes.list();
    const node = nodes.find((n) => n.name === tailnetNode.nodeName);
    expect(node).toBeDefined();
    expect(node?.registerMethod).toBe("REGISTER_METHOD_CLI");
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
    await client.nodes.toggleExpiry(workingNodeId, true);

    const permanentNode = await client.nodes.get(workingNodeId);
    expect(permanentNode).toBeDefined();
    expect(permanentNode.expiry).toBeNull();

    await client.nodes.toggleExpiry(workingNodeId, false);

    const node = await client.nodes.get(workingNodeId);
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
