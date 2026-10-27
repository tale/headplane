import { randomBytes } from "node:crypto";

import tc from "testcontainers";

import { createHeadscale } from "~/server/headscale/api";

import { createTestApp, type TestAppOptions } from "../support/app";
import { startHeadscale } from "./headscale";
import { type NodeOptions, startNode, startPendingNode } from "./node";
import { type HeadscaleVersion, LATEST_HEADSCALE } from "./versions";

export interface TailnetOptions {
  version?: HeadscaleVersion;
  policy?: string | object;
  headscaleConfig?: Record<string, unknown>;
  records?: Array<{ name: string; type: string; value: string }>;
  policyFile?: string;
}

export type Tailnet = Awaited<ReturnType<typeof createTailnet>>;

export async function createTailnet(options: TailnetOptions = {}) {
  const id = randomBytes(4).toString("hex");
  const version = options.version ?? LATEST_HEADSCALE;
  const network = await new tc.Network().start();
  const server = await startHeadscale({
    version,
    id,
    network,
    config: options.headscaleConfig,
    records: options.records,
    policyFile: options.policyFile,
    tls: true,
  });

  const headscale = await createHeadscale({ url: server.url, certPath: server.certPath });
  const api = headscale.client(server.apiKey);
  const target = { id, network, api, controlUrl: server.controlUrl, caCert: server.caCert! };
  const disposers: Array<() => Promise<unknown>> = [];

  async function setPolicy(policy: string | object) {
    await api.policy.set(typeof policy === "string" ? policy : JSON.stringify(policy, null, 2));
  }

  if (options.policy) {
    await setPolicy(options.policy);
  }

  async function user(name: string, profile: { email?: string; displayName?: string } = {}) {
    const [found] = await api.users.list({ name });
    return found ?? (await api.users.create({ name, ...profile }));
  }

  async function node(nodeOptions: NodeOptions) {
    const owner = nodeOptions.user ? await user(nodeOptions.user) : undefined;
    const key = await api.preAuthKeys.create({
      user: owner?.id ?? null,
      reusable: false,
      ephemeral: false,
      expiration: new Date(Date.now() + 60 * 60_000),
      aclTags: nodeOptions.tags ?? null,
    });

    const started = await startNode(target, nodeOptions, key.key);
    disposers.push(() => started.stop());
    return started;
  }

  async function setExpiry(nodeId: string, days: number) {
    const args = ["headscale", "nodes", "expire", "-i", nodeId];
    if (days > 0) {
      args.push("--expiry", new Date(Date.now() + days * 86_400_000).toISOString());
    }

    const result = await server.container.exec(args);
    if (result.exitCode !== 0) {
      throw new Error(`Expiring node ${nodeId} failed:\n${result.output}`);
    }
  }

  async function pendingNode(nodeOptions: NodeOptions) {
    const pending = await startPendingNode(target, nodeOptions);
    disposers.push(() => pending.stop());
    return pending;
  }

  // Headplane in-process, pointed at this tailnet's Headscale and its config
  // file. Disposed with the tailnet.
  async function headplane(appOptions: Pick<TestAppOptions, "config"> = {}) {
    const app = await createTestApp({
      headscale: { url: server.url, apiKey: server.apiKey },
      config: {
        ...appOptions.config,
        headscale: {
          tls_cert_path: server.certPath,
          config_path: server.configPath,
          dns_records_path: server.recordsPath,
          ...appOptions.config?.headscale,
        },
      },
    });

    disposers.push(() => app.dispose());
    return app;
  }

  async function dispose() {
    await Promise.allSettled(disposers.map((d) => d()));
    await headscale.dispose();
    await server.stop();
    await network.stop();
  }

  return {
    id,
    version,
    network,
    server,
    headscale,
    api,
    setPolicy,
    user,
    node,
    setExpiry,
    pendingNode,
    headplane,
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
}
