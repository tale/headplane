import { data } from "react-router";

import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { isDataWithApiError } from "~/server/headscale/api/error-client";
import { nodesResource, usersResource } from "~/server/headscale/live-store";
import { Capabilities } from "~/server/web/roles";
import log from "~/utils/log";

import type { Route } from "./+types/overview";

// The logic for deciding policy factors is very complicated because
// there are so many factors that need to be accounted for:
// 1. Does the user have permission to read the policy?
// 2. Does the user have permission to write to the policy?
// 3. Is the Headscale policy in file or database mode?
//    If database, we can read/write easily via the API.
//    If in file mode, we can only write if the Headscale config is available.
export async function aclLoader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const getRequestApi = context.get(requestApiContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const principal = await auth.require(request);
  const check = auth.can(principal, Capabilities.read_policy);
  if (!check) {
    throw data("You do not have permission to read the ACL policy.", {
      status: 403,
    });
  }

  const flags = {
    // Can the user write to the ACL policy
    access: auth.can(principal, Capabilities.write_policy),
    writable: false,
    policy: "",
    // Context for the visual editor: which users exist and which tags are
    // already in use. Both are best-effort, the editor degrades gracefully.
    users: [] as string[],
    tagUsage: [] as { tag: string; nodes: string[] }[],
  };

  // Try to load the ACL policy from the API.
  const { api } = await getRequestApi(request);

  try {
    const [nodesSnap, usersSnap] = await Promise.all([
      headscaleLiveStore.get(nodesResource, api),
      headscaleLiveStore.get(usersResource, api),
    ]);

    flags.users = usersSnap.data.map((user) => user.name).sort();

    const usage = new Map<string, string[]>();
    for (const node of nodesSnap.data) {
      for (const tag of node.tags) {
        usage.set(tag, [...(usage.get(tag) ?? []), node.givenName || node.name]);
      }
    }
    flags.tagUsage = Array.from(usage.entries())
      .map(([tag, nodes]) => ({ tag, nodes }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  } catch (error) {
    // The policy itself is what this page is about, so a failure to enrich it
    // with users and tag usage is not fatal.
    log.warn("api", "Failed to load ACL editor context: %s", String(error));
  }

  try {
    const { policy, updatedAt } = await api.policy.get();
    flags.writable = updatedAt !== null;
    flags.policy = policy;
    return flags;
  } catch (error) {
    if (isDataWithApiError(error)) {
      // Headscale returns "acl policy not found" when the policy mode is
      // set to file but no file exists, and returns a 500 when database
      // mode is used but the policies table is empty.
      // https://github.com/juanfont/headscale/blob/c4600346f9c29b514dc9725ac103efb9d0381f23/hscontrol/types/policy.go#L10
      if (error.data.rawData.includes("acl policy not found") || error.data.statusCode === 500) {
        flags.policy = "";
        flags.writable = true;
        return flags;
      }
    }

    throw error;
  }
}
