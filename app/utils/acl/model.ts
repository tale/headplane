// ACL evaluator — core type model.
//
// This module has NO dependency on server code or React. Everything here is a
// plain data shape so the evaluator can run in a loader (Node) or the browser
// (interactive re-eval), and be unit-tested in isolation.
//
// Terminology mirrors Headscale policy v2 (HuJSON):
//   groups     -> named sets of user identities        ("group:eng": ["alice@"])
//   tagOwners  -> who may assign a tag (NOT used for reachability, kept for UI)
//   hosts      -> named CIDR/IP aliases                ("server": "100.64.0.1/32")
//   acls[]     -> directional accept rules (src -> dst:ports over proto)

export type NodeId = string;

/** A single node reduced to only what ACL resolution needs. */
export interface AclNode {
  id: NodeId;
  name: string; // givenName || name, for labels
  ips: string[]; // ipAddresses, used for CIDR/host-alias matching
  user?: string; // User.name, normalized WITHOUT trailing "@" (see to-node.ts)
  tags: string[]; // e.g. ["tag:web"]; forced tags + advertised, as Headscale reports
  routes: string[]; // approvedRoutes — needed for autogroup:internet / subnet dsts
  hasExitNode: boolean; // approved 0.0.0.0/0 or ::/0
}

/** A parsed port range. `*` becomes { start: 0, end: 65535 }. */
export interface PortRange {
  start: number;
  end: number;
}

export type Protocol = "tcp" | "udp" | "icmp" | "sctp" | string;

/** One dst token split into its alias and its port spec. */
export interface DstEntry {
  alias: string; // "tag:web"        (everything before the final ":")
  ports: PortRange[]; // parsed from ":22,80-90" or ":*"
  raw: string; // original token, for display / debugging
}

export interface AclRule {
  index: number; // position in acls[]; the back-reference an edge carries
  action: "accept"; // Headscale v2 only supports accept in acls[]
  src: string[]; // raw src aliases (unexpanded)
  dst: DstEntry[];
  proto?: Protocol; // undefined = all protocols
}

export interface AclPolicy {
  groups: Record<string, string[]>;
  tagOwners: Record<string, string[]>;
  hosts: Record<string, string>;
  acls: AclRule[];
}

// --- Evaluation output -----------------------------------------------------

/** Why a given (src -> dst) edge exists: which rule + what it permits. */
export interface EdgeRule {
  ruleIndex: number;
  proto?: Protocol;
  ports: PortRange[];
  /**
   * The dst token that actually matched, as written in the policy. A rule can
   * declare many destinations; without this the UI can only show all of them,
   * most of which may have nothing to do with this pair.
   */
  dstAlias: string;
}

/** Sentinel dst for `autogroup:internet` — not a peer, the exit-node world. */
export const INTERNET: NodeId = "__internet__";

/**
 * Prefix for off-mesh subnet pseudo-nodes. A dst CIDR matching no tailnet node
 * is usually not a mistake — it is a LAN reachable through a subnet router — so
 * it becomes its own node rather than vanishing from the map.
 *
 * One pseudo-node PER DISTINCT CIDR, unlike the single INTERNET hub: subnets
 * are not interchangeable, and collapsing them would hide the routing story.
 */
const SUBNET_PREFIX = "__subnet__:";

export function subnetNodeId(cidr: string): NodeId {
  return `${SUBNET_PREFIX}${cidr}`;
}

export function isSubnetNodeId(id: NodeId): boolean {
  return id.startsWith(SUBNET_PREFIX);
}

/** The CIDR behind a subnet pseudo-node id, or null if `id` is not one. */
export function subnetCidrOf(id: NodeId): string | null {
  return isSubnetNodeId(id) ? id.slice(SUBNET_PREFIX.length) : null;
}

/** An off-mesh subnet reached as a dst, plus who advertises a route to it. */
export interface SubnetInfo {
  id: NodeId;
  cidr: string;
  /** Nodes whose approved routes cover this CIDR. Empty = nothing routes it. */
  routers: NodeId[];
}

export interface AclEdge {
  src: NodeId;
  dst: NodeId; // a real node id, INTERNET, or a subnet pseudo-node
  rules: EdgeRule[]; // one entry per rule/dst-port-spec that allows this pair
}

/**
 * A problem found while evaluating. Carries the rule it came from where that
 * is knowable, so the UI can offer to jump to it — a warning you cannot locate
 * is much less useful than one you can.
 */
export interface AclWarning {
  message: string;
  ruleIndex?: number;
  /**
   * The offending text as it appears in the policy, so the UI can highlight
   * the token itself rather than the whole rule around it.
   */
  token?: string;
}

export interface AclEvaluation {
  edges: AclEdge[];
  /**
   * The parsed rules, so the UI can show rule text next to an edge or node.
   * Indexed by position in the source policy — skipped (non-accept) rules are
   * absent, so look rules up by `.index`, not by array position.
   */
  rules: AclRule[];
  /** Off-mesh subnets that appeared as a dst; the map draws these as nodes. */
  subnets: SubnetInfo[];
  reachOut: Map<NodeId, NodeId[]>; // src -> everything it can reach
  reachIn: Map<NodeId, NodeId[]>; // dst -> everything that can reach it
  /**
   * alias -> node ids, for UI tooltips. Only STATIC aliases are listed here.
   * autogroup:self is deliberately absent: it couples src and dst, so it has
   * no context-free expansion (see resolve.ts).
   */
  expansions: Map<string, NodeId[]>;
  warnings: AclWarning[]; // unresolved aliases, wildcard blow-ups, etc.
}
