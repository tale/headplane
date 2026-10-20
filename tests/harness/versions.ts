// The newest patch of every Headscale minor Headplane supports. CI runs one
// job per version, listed in .github/workflows/build.yaml.
export const HEADSCALE_VERSIONS = ["0.27.1", "0.28.0", "0.29.5"] as const;
export type HeadscaleVersion = (typeof HEADSCALE_VERSIONS)[number];
export const LATEST_HEADSCALE = HEADSCALE_VERSIONS[HEADSCALE_VERSIONS.length - 1];

export const TAILSCALE_IMAGE = "tailscale/tailscale:v1.104.1";
export const DEX_IMAGE = "dexidp/dex:v2.41.1";
// Stands in for the browser, on the Node version Headplane runs on.
export const NODE_IMAGE = "node:24-slim";

// HP_HEADSCALE_VERSIONS: "all", a comma-separated list, or unset for the latest.
export function testedVersions(): readonly HeadscaleVersion[] {
  const env = process.env.HP_HEADSCALE_VERSIONS;
  if (!env) {
    return [LATEST_HEADSCALE];
  }

  if (env === "all") {
    return HEADSCALE_VERSIONS;
  }

  const requested = env.split(",").map((version) => version.trim());
  for (const version of requested) {
    if (!HEADSCALE_VERSIONS.includes(version as HeadscaleVersion)) {
      throw new Error(
        `HP_HEADSCALE_VERSIONS: ${version} isn't in ${HEADSCALE_VERSIONS.join(", ")}`,
      );
    }
  }

  return requested as HeadscaleVersion[];
}
