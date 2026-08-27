import { HostInfo, Machine } from "~/types";

export interface PopulatedNode extends Machine {
  routes: string[];
  hostInfo?: HostInfo;
  expired: boolean;
  customRouting: {
    exitRoutes: string[];
    exitApproved: boolean;
    subnetApprovedRoutes: string[];
    subnetWaitingRoutes: string[];
  };
}

const GO_ZERO_TIMES = new Set(["0001-01-01 00:00:00", "0001-01-01T00:00:00Z"]);
export function isNoExpiry(expiry: string | null | undefined): boolean {
  return expiry == null || GO_ZERO_TIMES.has(expiry);
}

export function mapNodes(
  nodes: Machine[],
  stats?: Record<string, HostInfo> | undefined,
): PopulatedNode[] {
  return nodes.map((node) => {
    const customRouting = {
      exitRoutes: node.availableRoutes.filter((route) => route === "::/0" || route === "0.0.0.0/0"),
      exitApproved: node.approvedRoutes.some((route) => route === "::/0" || route === "0.0.0.0/0"),
      subnetApprovedRoutes: node.approvedRoutes.filter(
        (route) =>
          route !== "::/0" && route !== "0.0.0.0/0" && node.availableRoutes.includes(route),
      ),
      subnetWaitingRoutes: node.availableRoutes.filter(
        (route) =>
          route !== "::/0" && route !== "0.0.0.0/0" && !node.approvedRoutes.includes(route),
      ),
    } satisfies PopulatedNode["customRouting"];

    return {
      ...node,
      routes: Array.from(new Set(node.availableRoutes)),
      hostInfo: stats?.[node.nodeKey],
      customRouting,
      expired: isNoExpiry(node.expiry) ? false : new Date(node.expiry!).getTime() < Date.now(),
    };
  });
}

export function sortNodeTags(nodes: Machine[]): string[] {
  return Array.from(new Set(nodes.flatMap((node) => node.tags))).sort();
}

export function sortAssignableTags(nodes: Machine[], policy?: string): string[] {
  return Array.from(
    new Set([...sortNodeTags(nodes), ...(extractTagOwnerTags(policy) ?? [])]),
  ).sort();
}

// The tags declared under `tagOwners`. An empty list means the policy declares
// none; `undefined` means the policy could not be read or parsed.
export function extractTagOwnerTags(policy: string | undefined): string[] | undefined {
  if (policy === undefined) {
    return undefined;
  }

  if (policy.trim().length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonCommentsAndTrailingCommas(policy));
  } catch {
    return undefined;
  }

  if (parsed == null || typeof parsed !== "object" || !("tagOwners" in parsed)) {
    return [];
  }

  const tagOwners = (parsed as { tagOwners?: unknown }).tagOwners;
  if (tagOwners == null || typeof tagOwners !== "object" || Array.isArray(tagOwners)) {
    return [];
  }

  return Object.keys(tagOwners)
    .filter((tag) => tag.startsWith("tag:"))
    .sort();
}

export function stripJsonCommentsAndTrailingCommas(input: string): string {
  return scanHuJson(input).stripped;
}

// Strips comments and trailing commas, and reports whether the input carried
// comments — a rewrite of the policy drops those, so callers warn first.
export function scanHuJson(input: string): { stripped: string; hasComments: boolean } {
  let output = "";
  let hasComments = false;
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      hasComments = true;
      i++;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      hasComments = true;
      i++;
      continue;
    }

    output += char;
  }

  return { stripped: output.replace(/,\s*([}\]])/g, "$1"), hasComments };
}
