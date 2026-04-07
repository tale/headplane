import { data } from "react-router";

import { isDataWithApiError } from "~/server/headscale/api/error-client";
import { Capabilities } from "~/server/web/roles";

import type { Route } from "./+types/overview";

// The logic for deciding policy factors is very complicated because
// there are so many factors that need to be accounted for:
// 1. Does the user have permission to read the policy?
// 2. Does the user have permission to write to the policy?
// 3. Is the Headscale policy in file or database mode?
//    If database, we can read/write easily via the API.
//    If in file mode, we can only write if context.config is available.
export async function aclLoader({ request, context }: Route.LoaderArgs) {
  const principal = await context.auth.require(request);
  const check = context.auth.can(principal, Capabilities.read_policy);
  if (!check) {
    throw data("You do not have permission to read the ACL policy.", {
      status: 403,
    });
  }

  const flags = {
    // Can the user write to the ACL policy
    access: context.auth.can(principal, Capabilities.write_policy),
    writable: false,
    policy: "",
  };

  // Try to load the ACL policy from the API.
  const apiKey = context.auth.getHeadscaleApiKey(principal);
  const api = context.hsApi.getRuntimeClient(apiKey);
  try {
    const { policy, updatedAt } = await api.getPolicy();
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
