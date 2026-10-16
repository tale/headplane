import * as v from "valibot";

import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { isDataWithApiError } from "~/server/headscale/api/error-client";
import { usersResource } from "~/server/headscale/live-store";
import { ActionError, createAction } from "~/server/web/actions";
import { isUserPrincipal } from "~/server/web/auth";
import { Capabilities, Roles, type Role } from "~/server/web/roles";
import { isValidGroupName, parsePolicy, serializePolicy, setUserGroups } from "~/utils/acl-policy";
import { invalid, list, ok } from "~/utils/form";

import { username } from "./schemas";

const id = v.pipe(v.string(), v.minLength(1));
const optionalText = v.pipe(
  v.optional(v.string(), ""),
  v.trim(),
  v.transform((value) => value || undefined),
);

const assignableRoles = Object.keys(Roles).filter((role) => role !== "owner") as Exclude<
  Role,
  "owner"
>[];

export const userAction = createAction({
  capability: Capabilities.write_users,
  async setup({ request, context }) {
    const { principal, api } = await context.get(requestApiContext)(request);
    const liveStore = context.get(headscaleLiveStoreContext);

    return {
      principal,
      api,
      auth: context.get(authContext),
      refresh: () => liveStore.refresh(usersResource, api),
    };
  },
  intents: {
    create: {
      fields: { name: username, display_name: optionalText, email: optionalText },
      async handler(input, { api, refresh }) {
        await api.users.create({
          name: input.name,
          displayName: input.display_name,
          email: input.email,
        });
        await refresh();
        return ok("User created");
      },
    },
    delete: {
      fields: { headscale_user_id: id },
      async handler(input, { api, auth, refresh }) {
        await api.users.delete(input.headscale_user_id);
        for (const user of await auth.listUsers()) {
          if (user.headscale_user_id === input.headscale_user_id) {
            await auth.unlinkHeadscaleUser(user.id);
          }
        }

        await refresh();
        return ok("User deleted");
      },
    },
    rename: {
      fields: { headscale_user_id: id, name: username },
      async handler(input, { api, refresh }) {
        const users = await api.users.list({ id: input.headscale_user_id });
        const user = users.find((user) => user.id === input.headscale_user_id);
        if (!user) {
          throw new ActionError("This user no longer exists.", 404);
        }

        if (user.provider === "oidc") {
          throw new ActionError("Users managed by OIDC can't be renamed.", 403);
        }

        await api.users.rename(user.id, input.name);
        await refresh();
        return ok("User renamed");
      },
    },
    reassign: {
      fields: { headplane_user_id: id, role: v.picklist(assignableRoles, "Choose a role.") },
      async handler(input, { auth }) {
        if (!(await auth.reassignUser(input.headplane_user_id, input.role))) {
          throw new ActionError("Couldn't change the role. Try again.", 500);
        }

        return ok("Role changed");
      },
    },
    transfer: {
      fields: { headplane_user_id: id },
      async handler(input, { auth, principal }) {
        if (!isUserPrincipal(principal) || principal.user.role !== "owner") {
          throw new ActionError("Only the owner can transfer ownership.", 403);
        }

        if (!(await auth.transferOwnership(principal.user.id, input.headplane_user_id))) {
          throw new ActionError("Couldn't transfer ownership. Try again.", 500);
        }

        return ok("Ownership transferred");
      },
    },
    link: {
      fields: {
        headplane_user_id: id,
        headscale_user_id: v.pipe(v.string(), v.minLength(1, "Choose a Headscale user.")),
      },
      async handler(input, { auth }) {
        if (!(await auth.linkHeadscaleUser(input.headplane_user_id, input.headscale_user_id))) {
          throw new ActionError("That Headscale user is already linked to another account.", 409);
        }

        return ok("Headscale user linked");
      },
    },
    update_groups: {
      // Group membership lives in the policy, so `write_policy` is needed too.
      capability: Capabilities.write_policy,
      fields: { user_name: id, groups: list() },
      async handler(input, { api }) {
        const groups = input.groups.map((group) => group.trim()).filter((group) => group !== "");
        const invalidGroups = groups.filter((group) => !isValidGroupName(group));
        if (invalidGroups.length > 0) {
          return invalid({ form: `Invalid group name: ${invalidGroups.join(", ")}` });
        }

        const { policy } = await api.policy.get();
        const parsed = parsePolicy(policy);
        if (!parsed.ok) {
          throw new ActionError(`The ACL policy couldn't be parsed: ${parsed.error}`);
        }

        try {
          await api.policy.set(
            serializePolicy(setUserGroups(parsed.policy, input.user_name, groups)),
          );
        } catch (error) {
          // Headscale refuses policy writes in `file` mode. The UI hides group
          // editing then, but a stale page can still get here.
          if (isDataWithApiError(error) && error.data.rawData.includes("update is disabled")) {
            throw new ActionError(
              "The ACL policy is read-only. Set `policy.mode` to `database` in your Headscale configuration to edit groups.",
              403,
            );
          }

          throw error;
        }

        return ok("Groups updated");
      },
    },
  },
});
