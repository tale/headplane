// Top-level orchestration: policy text + nodes -> directional reachability.

import {
  type AclEdge,
  type AclEvaluation,
  type AclNode,
  type AclWarning,
  type EdgeRule,
  INTERNET,
  type NodeId,
  type SubnetInfo,
} from "./model";
import { parsePolicy } from "./parse";
import { buildContext, cidrCovers, type EvalContext, expandAlias } from "./resolve";

/**
 * A wildcard rule on a large tailnet is quadratic: 500 nodes and one `*:*`
 * rule is 249,500 edges, which no browser will draw. Stop and say so rather
 * than locking up the tab on somebody else's policy.
 */
const MAX_EDGES = 20_000;

export function evaluatePolicy(policyText: string, nodes: AclNode[]): AclEvaluation {
  const { policy, warnings } = parsePolicy(policyText);
  const ctx = buildContext(policy, nodes);
  ctx.warnings.push(...warnings);

  const edgeMap = new Map<string, AclEdge>();
  let truncated = false;

  for (const rule of policy.acls) {
    // Alias resolution reports problems against whichever rule is current, so
    // a warning can be traced back to the line that caused it.
    ctx.ruleIndex = rule.index;
    // src cannot contain autogroup:self/internet — expanded once.
    const srcIds = new Set<NodeId>();
    for (const alias of rule.src)
      for (const id of expandAlias(alias, ctx, { side: "src" })) srcIds.add(id);

    for (const srcId of srcIds) {
      const srcNode = ctx.byId.get(srcId)!;
      // dst expanded PER src, because autogroup:self couples the two.
      for (const dst of rule.dst) {
        const dstIds = expandAlias(dst.alias, ctx, { side: "dst", counterpart: srcNode });
        for (const dstId of dstIds) {
          if (dstId === srcId) continue; // no self-loops (INTERNET never equals a src)
          if (edgeMap.size >= MAX_EDGES && !edgeMap.has(`${srcId} ${dstId}`)) {
            truncated = true;
            continue;
          }
          addEdge(edgeMap, srcId, dstId, {
            ruleIndex: rule.index,
            proto: rule.proto,
            ports: dst.ports,
            dstAlias: dst.alias,
          });
        }
      }
    }
  }

  if (truncated) {
    ctx.ruleIndex = undefined;
    ctx.warnings.push({
      message: `This policy produces more than ${MAX_EDGES.toLocaleString()} flows; the map shows the first ${MAX_EDGES.toLocaleString()} only. Narrow a wildcard rule to see the rest.`,
    });
  }

  const edges = [...edgeMap.values()];
  // staticExpansions can discover further subnets, so collect them after it.
  const expansions = staticExpansions(ctx);
  return {
    edges,
    rules: policy.acls,
    subnets: subnetInfos(ctx),
    reachOut: adjacency(edges, (e) => [e.src, e.dst]),
    reachIn: adjacency(edges, (e) => [e.dst, e.src]),
    expansions,
    warnings: dedupeWarnings(ctx.warnings),
  };
}

/** The same alias is re-expanded once per src, so warnings repeat verbatim. */
function dedupeWarnings(warnings: AclWarning[]): AclWarning[] {
  const seen = new Map<string, AclWarning>();
  for (const warning of warnings) {
    const key = `${warning.ruleIndex ?? "-"}:${warning.message}`;
    if (!seen.has(key)) seen.set(key, warning);
  }
  return [...seen.values()];
}

/** Attach each off-mesh subnet to the nodes advertising a route that covers it. */
function subnetInfos(ctx: EvalContext): SubnetInfo[] {
  return [...ctx.subnets].map(([id, cidr]) => ({
    id,
    cidr,
    routers: ctx.nodes.filter((n) => n.routes.some((r) => cidrCovers(r, cidr))).map((n) => n.id),
  }));
}

function addEdge(map: Map<string, AclEdge>, src: NodeId, dst: NodeId, rule: EdgeRule): void {
  const key = `${src} ${dst}`;
  const existing = map.get(key);
  if (existing) existing.rules.push(rule);
  else map.set(key, { src, dst, rules: [rule] });
}

function adjacency(
  edges: AclEdge[],
  pick: (e: AclEdge) => [NodeId, NodeId],
): Map<NodeId, NodeId[]> {
  const map = new Map<NodeId, Set<NodeId>>();
  for (const e of edges) {
    const [from, to] = pick(e);
    const set = map.get(from) ?? new Set<NodeId>();
    set.add(to);
    map.set(from, set);
  }
  return new Map([...map].map(([k, v]) => [k, [...v]]));
}

// Context-free alias expansions for UI tooltips. autogroup:self is omitted by
// construction (it needs a counterpart, so it has no static answer).
function staticExpansions(ctx: EvalContext): Map<string, NodeId[]> {
  const out = new Map<string, NodeId[]>();
  // The side must match how the alias is actually used: expanding a src-only
  // CIDR as a dst would mint a subnet pseudo-node that no rule points at.
  const record = (alias: string, side: "src" | "dst") => {
    if (out.has(alias)) return;
    out.set(alias, [...expandAlias(alias, ctx, { side })]);
  };
  for (const rule of ctx.policy.acls) {
    ctx.ruleIndex = rule.index;
    for (const a of rule.src) if (!isRelational(a)) record(a, "src");
    for (const d of rule.dst) if (!isRelational(d.alias)) record(d.alias, "dst");
  }
  ctx.ruleIndex = undefined;
  return out;
}

function isRelational(alias: string): boolean {
  return alias === "autogroup:self";
}

export { INTERNET };
