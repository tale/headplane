import { randomBytes } from "node:crypto";

import tc from "testcontainers";

import { createHeadscale } from "~/server/headscale/api";
import type { User } from "~/types";

import { createTestApp, type TestAppOptions } from "../support/app";
import { startHeadscale } from "./headscale";
import { type NodeOptions, startNode, startPendingNode, type TailnetNode } from "./node";
import { harnessCertificate } from "./tls";
import { type HeadscaleVersion, LATEST_HEADSCALE } from "./versions";

export interface TailnetOptions {
  version?: HeadscaleVersion;
  policy?: string | object;
  headscaleConfig?: Record<string, unknown>;
}

export interface AuthKeyOptions {
  user?: string;
  tags?: string[];
  reusable?: boolean;
  ephemeral?: boolean;
}

export type Tailnet = Awaited<ReturnType<typeof createTailnet>>;

export async function createTailnet(options: TailnetOptions = {}) {
  const id = randomBytes(4).toString("hex");
  const version = options.version ?? LATEST_HEADSCALE;
  const network = await new tc.Network().start();
  const headscale = await startHeadscale({
    version,
    network,
    config: options.headscaleConfig,
    tls: true,
    id,
  });

  const caCert = (await harnessCertificate()).cert;
  const hs = await createHeadscale({ url: headscale.url, certPath: headscale.certPath });
  const api = hs.client(headscale.apiKey);
  const users = new Map<string, User>();
  const nodes: TailnetNode[] = [];
  const disposers: Array<() => Promise<unknown>> = [];

  async function setPolicy(policy: string | object) {
    await api.policy.set(typeof policy === "string" ? policy : JSON.stringify(policy, null, 2));
  }

  if (options.policy) {
    await setPolicy(options.policy);
  }

  async function user(name: string, profile: { email?: string; displayName?: string } = {}) {
    const existing = users.get(name);
    if (existing) {
      return existing;
    }

    const [found] = await api.users.list({ name });
    const resolved = found ?? (await api.users.create({ name, ...profile }));
    users.set(name, resolved);
    return resolved;
  }

  async function authKey(keyOptions: AuthKeyOptions = {}) {
    if (!keyOptions.user && !hs.capabilities.preAuthKeysHaveStableIds) {
      throw new Error(`Headscale ${version} can't create tag-only auth keys`);
    }

    const owner = keyOptions.user ? await user(keyOptions.user) : undefined;
    const key = await api.preAuthKeys.create({
      user: owner?.id ?? null,
      reusable: keyOptions.reusable ?? false,
      ephemeral: keyOptions.ephemeral ?? false,
      expiration: new Date(Date.now() + 60 * 60_000),
      aclTags: keyOptions.tags ?? null,
    });

    return key.key;
  }

  async function node(nodeOptions: NodeOptions) {
    const key = await authKey({
      user: nodeOptions.user,
      tags: nodeOptions.tags,
      ephemeral: nodeOptions.ephemeral,
    });

    const started = await startNode({
      ...nodeOptions,
      id,
      network,
      api,
      controlUrl: headscale.controlUrl,
      caCert,
      authKey: key,
    });
    nodes.push(started);
    return started;
  }

  async function pendingNode(nodeOptions: NodeOptions) {
    const pending = await startPendingNode({
      ...nodeOptions,
      id,
      network,
      api,
      controlUrl: headscale.controlUrl,
      caCert,
    });
    disposers.push(() => pending.container.stop({ remove: true, removeVolumes: true }));
    return pending;
  }

  // Headplane in-process, pointed at this tailnet's Headscale and its config
  // file. Disposed with the tailnet.
  async function headplane(appOptions: Pick<TestAppOptions, "config"> = {}) {
    const client = await createHeadscale({ url: headscale.url, certPath: headscale.certPath });
    const app = await createTestApp({
      headscale: { headscale: client, apiKey: headscale.apiKey },
      config: {
        ...appOptions.config,
        headscale: {
          url: headscale.url,
          tls_cert_path: headscale.certPath,
          config_path: headscale.configPath,
          ...appOptions.config?.headscale,
        },
      },
    });

    disposers.push(() => app.dispose());
    return app;
  }

  async function dispose() {
    await Promise.allSettled(disposers.map((d) => d()));
    await Promise.allSettled(nodes.map((n) => n.stop()));
    await hs.dispose();
    await headscale.stop();
    await network.stop();
  }

  return {
    id,
    version,
    headscale,
    hs,
    api,
    network,
    nodes,
    setPolicy,
    user,
    authKey,
    node,
    pendingNode,
    headplane,
    onDispose(disposer: () => Promise<unknown>) {
      disposers.push(disposer);
    },
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
}
