// Alias resolution: turn a policy token into the set of nodes it matches.
// See the token catalogue in the header comment of the previous revision.

import {
  type AclNode,
  type AclPolicy,
  type AclWarning,
  INTERNET,
  type NodeId,
  subnetNodeId,
} from "./model";

interface Cidr {
  // IPv4 only for now (this fork's policies are v4). v6 tokens fall back to
  // exact-string match against node ips; see matchIp.
  net: number;
  mask: number;
}

interface IndexedNode {
  node: AclNode;
  v4: number[]; // parsed IPv4 addresses
  v6: string[]; // raw IPv6 strings, for exact-match fallback
}

export interface EvalContext {
  policy: AclPolicy;
  nodes: AclNode[];
  byId: Map<NodeId, AclNode>;
  byUser: Map<string, NodeId[]>;
  byTag: Map<string, NodeId[]>;
  indexed: IndexedNode[];
  /** Off-mesh subnet pseudo-nodes discovered during expansion: id -> cidr. */
  subnets: Map<NodeId, string>;
  warnings: AclWarning[];
  /**
   * The rule being expanded, set by evaluate.ts as it walks acls[]. Alias
   * resolution has no rule context of its own, but a warning without one
   * cannot be located in the policy.
   */
  ruleIndex?: number;
}

/**
 * Record a problem against whichever rule is currently being expanded, and
 * against the specific token at fault where there is one.
 */
function warn(ctx: EvalContext, message: string, token?: string): void {
  ctx.warnings.push({ message, ruleIndex: ctx.ruleIndex, token });
}

export function buildContext(policy: AclPolicy, nodes: AclNode[]): EvalContext {
  const byId = new Map<NodeId, AclNode>();
  const byUser = new Map<string, NodeId[]>();
  const byTag = new Map<string, NodeId[]>();
  const indexed: IndexedNode[] = [];

  for (const node of nodes) {
    byId.set(node.id, node);
    if (node.user) push(byUser, normalizeUser(node.user), node.id);
    for (const tag of node.tags) push(byTag, tag, node.id);

    const v4: number[] = [];
    const v6: string[] = [];
    for (const ip of node.ips) {
      const n = v4ToInt(ip);
      if (n != null) v4.push(n);
      else v6.push(ip);
    }
    indexed.push({ node, v4, v6 });
  }

  return { policy, nodes, byId, byUser, byTag, indexed, subnets: new Map(), warnings: [] };
}

export interface ExpandOptions {
  side: "src" | "dst";
  counterpart?: AclNode; // required only for autogroup:self
}

export function expandAlias(alias: string, ctx: EvalContext, opts: ExpandOptions): Set<NodeId> {
  const out = new Set<NodeId>();

  if (alias === "*") {
    for (const n of ctx.nodes) out.add(n.id);
    return out;
  }

  if (alias.startsWith("tag:")) {
    for (const id of ctx.byTag.get(alias) ?? []) out.add(id);
    return out;
  }

  if (alias.startsWith("group:")) {
    for (const id of expandGroup(alias, ctx, new Set())) out.add(id);
    return out;
  }

  if (alias.startsWith("autogroup:")) {
    return expandAutogroup(alias, ctx, opts);
  }

  // Host alias -> its CIDR, then IP match.
  const hostCidr = ctx.policy.hosts[alias];
  if (hostCidr != null) {
    matchCidrOrSubnet(out, hostCidr, ctx, opts, alias);
    return out;
  }

  // Raw CIDR or IP.
  if (looksLikeIp(alias)) {
    matchCidrOrSubnet(out, alias, ctx, opts, alias);
    return out;
  }

  // Otherwise a bare user identity.
  const ids = ctx.byUser.get(normalizeUser(alias));
  if (ids) for (const id of ids) out.add(id);
  else warn(ctx, `Unresolved alias "${alias}" (no matching user, tag, host, or IP)`, alias);
  return out;
}

function expandAutogroup(alias: string, ctx: EvalContext, opts: ExpandOptions): Set<NodeId> {
  const out = new Set<NodeId>();
  switch (alias) {
    case "autogroup:internet":
      if (opts.side === "dst") out.add(INTERNET);
      else warn(ctx, `autogroup:internet is not valid as a src`, "autogroup:internet");
      return out;
    case "autogroup:member":
      for (const n of ctx.nodes) if (n.user && n.tags.length === 0) out.add(n.id);
      return out;
    case "autogroup:tagged":
      for (const n of ctx.nodes) if (n.tags.length > 0) out.add(n.id);
      return out;
    case "autogroup:self": {
      if (opts.side !== "dst" || !opts.counterpart?.user) {
        warn(ctx, `autogroup:self needs a dst context with a user-owned src`, "autogroup:self");
        return out;
      }
      const owner = normalizeUser(opts.counterpart.user);
      for (const n of ctx.nodes)
        if (n.user && normalizeUser(n.user) === owner && n.tags.length === 0) out.add(n.id);
      return out;
    }
    default:
      warn(ctx, `Unknown autogroup "${alias}"`, alias);
      return out;
  }
}

function expandGroup(group: string, ctx: EvalContext, seen: Set<string>): Set<NodeId> {
  const out = new Set<NodeId>();
  if (seen.has(group)) return out; // cycle guard
  seen.add(group);
  const members = ctx.policy.groups[group];
  if (!members) {
    warn(ctx, `Undefined group "${group}"`, group);
    return out;
  }
  for (const member of members) {
    if (member.startsWith("group:")) for (const id of expandGroup(member, ctx, seen)) out.add(id);
    else if (member.startsWith("tag:")) for (const id of ctx.byTag.get(member) ?? []) out.add(id);
    else for (const id of ctx.byUser.get(normalizeUser(member)) ?? []) out.add(id);
  }
  return out;
}

// --- IP / CIDR helpers (IPv4) ----------------------------------------------

/**
 * Match a CIDR against the tailnet. If nothing matches, the range is off-mesh:
 * as a dst it becomes a subnet pseudo-node so the map can draw it, as a src it
 * is only reported — a subnet has no node for an edge to originate from.
 */
function matchCidrOrSubnet(
  out: Set<NodeId>,
  cidr: string,
  ctx: EvalContext,
  opts: ExpandOptions,
  label: string,
): void {
  if (matchCidrInto(out, cidr, ctx)) return;

  if (opts.side === "dst") {
    const id = subnetNodeId(cidr);
    ctx.subnets.set(id, cidr);
    out.add(id);
    return;
  }

  warn(
    ctx,
    `"${label}" matches no node; an off-mesh range as src cannot be drawn (only dst ranges become subnets)`,
    label,
  );
}

/** Returns true if the token matched at least one node. */
function matchCidrInto(out: Set<NodeId>, token: string, ctx: EvalContext): boolean {
  let matched = false;
  const cidr = parseCidr(token);
  if (!cidr) {
    // Not v4 — fall back to exact string match (covers v6 tokens).
    for (const ix of ctx.indexed)
      if (ix.v6.includes(token)) {
        out.add(ix.node.id);
        matched = true;
      }
    return matched;
  }
  for (const ix of ctx.indexed)
    for (const ip of ix.v4)
      if ((ip & cidr.mask) === (cidr.net & cidr.mask)) {
        out.add(ix.node.id);
        matched = true;
        break;
      }
  return matched;
}

/**
 * True if CIDR `outer` fully contains `inner` — used to find which node's
 * approved routes serve a subnet. Masks are contiguous, so a numerically
 * smaller mask is the broader prefix.
 */
export function cidrCovers(outer: string, inner: string): boolean {
  if (outer === inner) return true;
  const o = parseCidr(outer);
  const i = parseCidr(inner);
  if (!o || !i) return false;
  if (o.mask > i.mask) return false; // outer is narrower than inner
  return (i.net & o.mask) === (o.net & o.mask);
}

function parseCidr(token: string): Cidr | null {
  const [addr, bitsRaw] = token.split("/");
  const net = v4ToInt(addr);
  if (net == null) return null;
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { net, mask };
}

function v4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const x = Number(p);
    if (!Number.isInteger(x) || x < 0 || x > 255 || (p.length > 1 && p[0] === "0")) return null;
    n = (n << 8) | x;
  }
  return n >>> 0;
}

function looksLikeIp(token: string): boolean {
  return token.includes("/") || token.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(token);
}

function normalizeUser(u: string): string {
  return u.endsWith("@") ? u.slice(0, -1) : u;
}

function push(map: Map<string, NodeId[]>, key: string, id: NodeId): void {
  const arr = map.get(key);
  if (arr) arr.push(id);
  else map.set(key, [id]);
}

export { INTERNET };
