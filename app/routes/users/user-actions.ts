import { data } from "react-router";

import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { usersResource } from "~/server/headscale/live-store";
import { isUserPrincipal } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";
import type { Role } from "~/server/web/roles";

import type { Route } from "./+types/overview";

export async function userAction({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const getRequestApi = context.get(requestApiContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const principal = await auth.require(request);
  const check = await auth.can(principal, Capabilities.write_users);
  if (!check) {
    throw data("You do not have permission to update users", {
      status: 403,
    });
  }

  const formData = await request.formData();
  const action = formData.get("action_id")?.toString();
  if (!action) {
    throw data("Missing `action_id` in the form data.", {
      status: 404,
    });
  }

  const { api } = await getRequestApi(request);
  switch (action) {
    case "create_user": {
      const name = formData.get("username")?.toString();
      const displayName = formData.get("display_name")?.toString();
      const email = formData.get("email")?.toString();

      if (!name) {
        throw data("Missing `username` in the form data.", {
          status: 400,
        });
      }

      await api.users.create({ name, email, displayName });
      await headscaleLiveStore.refresh(usersResource, api);
      return { message: "User created successfully" };
    }
    case "delete_user": {
      const headscaleUserId = formData.get("headscale_user_id")?.toString();
      if (!headscaleUserId) {
        throw data("Missing `headscale_user_id` in the form data.", {
          status: 400,
        });
      }

      await api.users.delete(headscaleUserId);
      await headscaleLiveStore.refresh(usersResource, api);
      return { message: "User deleted successfully" };
    }
    case "rename_user": {
      const headscaleUserId = formData.get("headscale_user_id")?.toString();
      const newName = formData.get("new_name")?.toString();
      if (!headscaleUserId || !newName) {
        return data({ success: false }, 400);
      }

      const users = await api.users.list({ id: headscaleUserId });
      const user = users.find((user) => user.id === headscaleUserId);
      if (!user) {
        throw data(`No user found with id: ${headscaleUserId}`, { status: 400 });
      }

      if (user.provider === "oidc") {
        // OIDC users cannot be renamed via this endpoint, return an error
        throw data("Users managed by OIDC cannot be renamed", {
          status: 403,
        });
      }

      await api.users.rename(headscaleUserId, newName);
      await headscaleLiveStore.refresh(usersResource, api);
      return { message: "User renamed successfully" };
    }
    case "reassign_user": {
      const headplaneUserId = formData.get("headplane_user_id")?.toString();
      const newRole = formData.get("new_role")?.toString();
      if (!headplaneUserId || !newRole) {
        throw data("Missing `headplane_user_id` or `new_role` in the form data.", {
          status: 400,
        });
      }

      const result = await auth.reassignUser(headplaneUserId, newRole as Role);
      if (!result) {
        throw data("Failed to reassign user role.", { status: 500 });
      }

      return { message: "User reassigned successfully" };
    }
    case "transfer_ownership": {
      if (!isUserPrincipal(principal) || principal.user.role !== "owner") {
        throw data("Only the owner can transfer ownership.", { status: 403 });
      }

      const headplaneUserId = formData.get("headplane_user_id")?.toString();
      if (!headplaneUserId) {
        throw data("Missing `headplane_user_id` in the form data.", { status: 400 });
      }

      const result = await auth.transferOwnership(principal.user.id, headplaneUserId);
      if (!result) {
        throw data("Failed to transfer ownership.", { status: 500 });
      }

      return { message: "Ownership transferred successfully" };
    }
    case "link_user": {
      const headplaneUserId = formData.get("headplane_user_id")?.toString();
      const headscaleUserId = formData.get("headscale_user_id")?.toString();
      if (!headplaneUserId || !headscaleUserId) {
        throw data("Missing `headplane_user_id` or `headscale_user_id` in the form data.", {
          status: 400,
        });
      }

      const linked = await auth.linkHeadscaleUser(headplaneUserId, headscaleUserId);
      if (!linked) {
        throw data("That Headscale user is already linked to another account.", { status: 409 });
      }

      return { message: "Headscale user linked successfully" };
    }
    default:
      throw data("Invalid `action_id` provided.", {
        status: 400,
      });
  }
}
