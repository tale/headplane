// Adapter: PopulatedNode (headplane's node shape) -> AclNode (evaluator input).
//
// Kept separate so the evaluator never imports app types. Headscale keys ACL
// `src`/dst user tokens on the plain user name (it appends "@" itself when it
// canonicalizes identities), and tag-only nodes may have no user at all.

import type { PopulatedNode } from "~/utils/node-info";

import type { AclNode } from "./model";

export function toAclNode(node: PopulatedNode): AclNode {
  return {
    id: node.id,
    name: node.givenName || node.name,
    ips: node.ipAddresses,
    user: node.user?.name, // may be undefined for tag-only nodes (HS 0.28+)
    tags: node.tags,
    routes: node.customRouting.subnetApprovedRoutes,
    hasExitNode: node.customRouting.exitApproved,
  };
}
