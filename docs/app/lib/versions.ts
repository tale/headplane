import { engines } from "../../../package.json";

// The one place to bump versions the docs mention. MDX pages import this and
// write `{versions.headscale.minimum}`.
export const versions = {
  node: engines.node,
  pnpm: engines.pnpm,
  headscale: {
    minimum: "0.27.0",
    agent: "0.28",
    ssh: "0.28",
    example: "0.29.5",
  },
};

export function resolveVersion(key: string) {
  const value = key
    .split(".")
    .reduce<unknown>((scope, part) => (scope as Record<string, unknown>)?.[part], versions);
  if (typeof value !== "string") {
    throw new Error(`Unknown docs version: versions.${key}`);
  }

  return value;
}
