import type { Machine } from "~/types";

import type { Capabilities } from "../capabilities";
import type { Transport } from "../transport";

interface RawMachine extends Omit<Machine, "tags"> {
  tags?: string[];
  forcedTags?: string[];
  validTags?: string[];
  invalidTags?: string[];
}

export interface NodeApi {
  list(): Promise<Machine[]>;
  get(id: string): Promise<Machine>;
  delete(id: string): Promise<void>;
  register(user: string, key: string): Promise<Machine>;
  approveRoutes(id: string, routes: string[]): Promise<void>;
  expire(id: string): Promise<void>;
  rename(id: string, newName: string): Promise<void>;
  setTags(id: string, tags: string[]): Promise<void>;
  toggleExpiry(nodeId: string, disableExpiry: boolean): Promise<void>;
  /**
   * Reassign a node to a different user. Only present when
   * `capabilities.nodeOwnerIsImmutable` is false (Headscale < 0.28).
   */
  reassignUser?: (id: string, user: string) => Promise<void>;
}

export function makeNodeApi(
  transport: Transport,
  capabilities: Capabilities,
  apiKey: string,
): NodeApi {
  function normalize(raw: RawMachine): Machine {
    if (capabilities.nodeTagsAreFlat) {
      return { ...raw, tags: raw.tags ?? [] } as Machine;
    }
    const tags = Array.from(new Set([...(raw.forcedTags ?? []), ...(raw.validTags ?? [])]));
    return { ...raw, tags } as Machine;
  }

  const api: NodeApi = {
    list: async () => {
      const { nodes } = await transport.request<{ nodes: RawMachine[] }>({
        method: "GET",
        path: "v1/node",
        apiKey,
      });
      return nodes.map(normalize);
    },
    get: async (id) => {
      const { node } = await transport.request<{ node: RawMachine }>({
        method: "GET",
        path: `v1/node/${id}`,
        apiKey,
      });
      return normalize(node);
    },
    delete: async (id) => {
      await transport.request({ method: "DELETE", path: `v1/node/${id}`, apiKey });
    },
    register: async (user, key) => {
      // Headscale's node-register endpoint expects the registration
      // params as both query string and body — preserved as-is.
      const qp = new URLSearchParams();
      qp.append("user", user);
      qp.append("key", key);
      const { node } = await transport.request<{ node: RawMachine }>({
        method: "POST",
        path: `v1/node/register?${qp.toString()}`,
        apiKey,
        body: { user, key },
      });
      return normalize(node);
    },
    approveRoutes: async (id, routes) => {
      await transport.request({
        method: "POST",
        path: `v1/node/${id}/approve_routes`,
        apiKey,
        body: { routes },
      });
    },
    expire: async (id) => {
      await transport.request({ method: "POST", path: `v1/node/${id}/expire`, apiKey });
    },
    rename: async (id, newName) => {
      await transport.request({
        method: "POST",
        path: `v1/node/${id}/rename/${encodeURIComponent(newName)}`,
        apiKey,
      });
    },
    setTags: async (id, tags) => {
      await transport.request({
        method: "POST",
        path: `v1/node/${id}/tags`,
        apiKey,
        body: { tags },
      });
    },
    toggleExpiry: async (nodeId, disableExpiry) => {
      await transport.request({
        method: "POST",
        path: `v1/node/${nodeId}/expire?disableExpiry=${disableExpiry}`,
        apiKey,
      });
    },
  };

  if (!capabilities.nodeOwnerIsImmutable) {
    api.reassignUser = async (id, user) => {
      await transport.request({
        method: "POST",
        path: `v1/node/${id}/user`,
        apiKey,
        body: { user },
      });
    };
  }

  return api;
}
