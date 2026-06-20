import { createHeadscale, type Headscale } from "~/server/headscale/api";

import { type HeadscaleEnv, startHeadscale } from "./start-headscale";
import { startTailscaleNode, TailscaleNodeEnv } from "./start-tailscale";

// The set of Headscale versions integration tests run against. Listed
// explicitly (rather than derived from a generated manifest) so the
// supported version matrix lives next to the code that uses it.
export const HS_VERSIONS = ["0.27.0", "0.27.1", "0.28.0", "0.29.0", "0.29.1"] as const;
export type Version = (typeof HS_VERSIONS)[number];

interface VersionStateEntry {
  env: HeadscaleEnv;
  tailscaleNode: TailscaleNodeEnv;
  bootstrap: Headscale;
}

const versionState = new Map<Version, VersionStateEntry>();
async function ensureVersion(version: Version) {
  if (versionState.has(version)) {
    return versionState.get(version)!;
  }

  const env = await startHeadscale(version);
  const tailscaleNode = await startTailscaleNode(version, env.container.getMappedPort(8080));
  const bootstrap = await createHeadscale({ url: env.apiUrl });

  const entry = { env, tailscaleNode, bootstrap };
  versionState.set(version, entry);
  return entry;
}

export async function getBootstrapClient(version: Version) {
  const { bootstrap } = await ensureVersion(version);
  return bootstrap;
}

export async function getRuntimeClient(version: Version) {
  const { env, bootstrap } = await ensureVersion(version);
  return bootstrap.client(env.apiKey);
}

export async function getNode(version: Version) {
  const { tailscaleNode } = await ensureVersion(version);
  return {
    authCode: tailscaleNode.authCode,
    nodeName: tailscaleNode.nodeName,
  };
}

export async function stopAllVersions() {
  for (const { env, tailscaleNode, bootstrap } of versionState.values()) {
    await bootstrap.dispose();

    await env.container.stop({
      remove: true,
      removeVolumes: true,
    });

    await tailscaleNode.container.stop({
      remove: true,
      removeVolumes: true,
    });
  }

  versionState.clear();
}
