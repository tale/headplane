import type { Machine } from "~/types";

import type { HeadscaleApiInterface } from "..";

import { defineApiEndpoints } from "../factory";

interface RawMachine extends Omit<Machine, "tags"> {
  tags?: string[];
  forcedTags?: string[];
  validTags?: string[];
  invalidTags?: string[];
}

/**
 * Normalizes the tags of a RawMachine based on the Headscale version.
 *
 * @param client The Headscale API client helper.
 * @param node The RawMachine object to normalize.
 * @returns A Machine object with normalized tags.
 */
function normalizeTags(client: HeadscaleApiInterface["clientHelpers"], node: RawMachine): Machine {
  if (client.isAtleast("0.28.0")) {
    return { ...node, tags: node.tags ?? [] } as Machine;
  }

  const tags = Array.from(new Set([...(node.forcedTags ?? []), ...(node.validTags ?? [])]));

  return { ...node, tags } as Machine;
}

export interface NodeEndpoints {
  /**
   * Retrieves all nodes (machines) from the Headscale instance.
   *
   * @returns An array of `Machine` objects representing the nodes.
   */
  getNodes(): Promise<Machine[]>;

  /**
   * Retrieves a specific node (machine) by its ID.
   *
   * @param id The ID of the node to retrieve.
   * @returns A `Machine` object representing the node.
   */
  getNode(id: string): Promise<Machine>;

  /**
   * Deletes a specific node (machine) by its ID.
   *
   * @param id The ID of the node to delete.
   */
  deleteNode(id: string): Promise<void>;

  /**
   * Registers a new node (machine) with the given user and key.
   *
   * @param user The user to associate with the node.
   * @param key The registration key for the node.
   * @returns A `Machine` object representing the newly registered node.
   */
  registerNode(user: string, key: string): Promise<Machine>;

  /**
   * Approves routes for a specific node (machine) by its ID.
   *
   * @param id The ID of the node.
   * @param routes An array of routes to approve for the node.
   */
  approveNodeRoutes(id: string, routes: string[]): Promise<void>;

  /**
   * Expires a specific node (machine) by its ID.
   *
   * @param id The ID of the node to expire.
   */
  expireNode(id: string): Promise<void>;

  /**
   * Renames a specific node (machine) by its ID.
   *
   * @param id The ID of the node to rename.
   * @param newName The new name for the node.
   */
  renameNode(id: string, newName: string): Promise<void>;

  /**
   * Sets tags for a specific node (machine) by its ID.
   *
   * @param id The ID of the node.
   * @param tags An array of tags to set for the node.
   */
  setNodeTags(id: string, tags: string[]): Promise<void>;

  /**
   * Sets the user for a specific node (machine) by its ID.
   *
   * @param id The ID of the node.
   * @param user The user to set for the node.
   */
  setNodeUser(id: string, user: string): Promise<void>;
}

export default defineApiEndpoints<NodeEndpoints>((client, apiKey) => ({
  getNodes: async () => {
    const { nodes } = await client.apiFetch<{ nodes: RawMachine[] }>("GET", "v1/node", apiKey);
    return nodes.map((node) => normalizeTags(client, node));
  },

  getNode: async (nodeId) => {
    const { node } = await client.apiFetch<{ node: RawMachine }>(
      "GET",
      `v1/node/${nodeId}`,
      apiKey,
    );

    return normalizeTags(client, node);
  },

  deleteNode: async (nodeId) => {
    await client.apiFetch<void>("DELETE", `v1/node/${nodeId}`, apiKey);
  },

  registerNode: async (user, key) => {
    const qp = new URLSearchParams();
    qp.append("user", user);
    qp.append("key", key);
    const { node } = await client.apiFetch<{ node: RawMachine }>(
      "POST",
      `v1/node/register?${qp.toString()}`,
      apiKey,
      {
        user,
        key,
      },
    );

    return normalizeTags(client, node);
  },

  approveNodeRoutes: async (nodeId, routes) => {
    await client.apiFetch<void>("POST", `v1/node/${nodeId}/approve_routes`, apiKey, { routes });
  },

  expireNode: async (nodeId) => {
    await client.apiFetch<void>("POST", `v1/node/${nodeId}/expire`, apiKey);
  },

  renameNode: async (nodeId, newName) => {
    await client.apiFetch<void>("POST", `v1/node/${nodeId}/rename/${newName}`, apiKey);
  },

  setNodeTags: async (nodeId, tags) => {
    await client.apiFetch<void>("POST", `v1/node/${nodeId}/tags`, apiKey, {
      tags,
    });
  },

  setNodeUser: async (nodeId, user) => {
    await client.apiFetch<void>("POST", `v1/node/${nodeId}/user`, apiKey, {
      user,
    });
  },
}));
