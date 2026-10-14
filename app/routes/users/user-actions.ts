import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { headscaleErrorMessage, isDataWithApiError } from "~/server/headscale/api/error-client";
import { usersResource } from "~/server/headscale/live-store";
import { isUserPrincipal } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";
import { isValidGroupName, parsePolicy, serializePolicy, setUserGroups } from "~/utils/acl-policy";
import { invalid, ok, parseForm } from "~/utils/form";

import type { Route } from "./+types/overview";
import { userAction as userActionSchema } from "./schemas";

export async function userAction({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const getRequestApi = context.get(requestApiContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const principal = await auth.requireCapability(request, Capabilities.write_users);
  const form = await parseForm(request, userActionSchema);
  if (!form.ok) {
    return invalid(form.errors);
  }

  const input = form.data;
  const { api } = await getRequestApi(request);

  try {
    switch (input.intent) {
      case "create":
        await api.users.create({
          name: input.name,
          displayName: input.display_name,
          email: input.email,
        });
        await headscaleLiveStore.refresh(usersResource, api);
        return ok("User created");

      case "delete":
        await api.users.delete(input.headscale_user_id);
        await headscaleLiveStore.refresh(usersResource, api);
        return ok("User deleted");

      case "rename": {
        const users = await api.users.list({ id: input.headscale_user_id });
        const user = users.find((user) => user.id === input.headscale_user_id);
        if (!user) {
          return invalid({ form: "This user no longer exists." }, 404);
        }

        if (user.provider === "oidc") {
          return invalid({ form: "Users managed by OIDC can't be renamed." }, 403);
        }

        await api.users.rename(user.id, input.name);
        await headscaleLiveStore.refresh(usersResource, api);
        return ok("User renamed");
      }

      case "reassign":
        if (!(await auth.reassignUser(input.headplane_user_id, input.role))) {
          return invalid({ form: "Couldn't change the role. Try again." }, 500);
        }

        return ok("Role changed");

      case "transfer":
        if (!isUserPrincipal(principal) || principal.user.role !== "owner") {
          return invalid({ form: "Only the owner can transfer ownership." }, 403);
        }

        if (!(await auth.transferOwnership(principal.user.id, input.headplane_user_id))) {
          return invalid({ form: "Couldn't transfer ownership. Try again." }, 500);
        }

        return ok("Ownership transferred");

      case "link":
        if (!(await auth.linkHeadscaleUser(input.headplane_user_id, input.headscale_user_id))) {
          return invalid(
            { form: "That Headscale user is already linked to another account." },
            409,
          );
        }

        return ok("Headscale user linked");

      case "update_groups": {
        // Group membership lives in the policy, so `write_policy` is needed too.
        if (!auth.can(principal, Capabilities.write_policy)) {
          return invalid({ form: "You don't have permission to edit the ACL policy." }, 403);
        }

        const groups = input.groups.map((group) => group.trim()).filter((group) => group !== "");
        const invalidGroups = groups.filter((group) => !isValidGroupName(group));
        if (invalidGroups.length > 0) {
          return invalid({ form: `Invalid group name: ${invalidGroups.join(", ")}` });
        }

        const { policy } = await api.policy.get();
        const parsed = parsePolicy(policy);
        if (!parsed.ok) {
          return invalid({ form: `The ACL policy couldn't be parsed: ${parsed.error}` });
        }

        await api.policy.set(
          serializePolicy(setUserGroups(parsed.policy, input.user_name, groups)),
        );
        return ok("Groups updated");
      }
    }
  } catch (error) {
    // Headscale refuses policy writes in `file` mode. The UI hides group
    // editing then, but a stale page can still get here.
    if (isDataWithApiError(error) && error.data.rawData.includes("update is disabled")) {
      return invalid(
        {
          form: "The ACL policy is read-only. Set `policy.mode` to `database` in your Headscale configuration to edit groups.",
        },
        403,
      );
    }

    const message = headscaleErrorMessage(error);
    if (message) {
      return invalid({ form: message });
    }

    throw error;
  }
}
