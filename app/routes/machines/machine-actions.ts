import { data, redirect } from "react-router";

import { isDataWithApiError } from "~/server/headscale/api/error-client";
import { nodesResource } from "~/server/headscale/live-store";
import { Capabilities } from "~/server/web/roles";

import type { Route } from "./+types/machine";

export async function machineAction({ request, context }: Route.ActionArgs) {
  const principal = await context.auth.require(request);

  const formData = await request.formData();
  const api = context.hsApi.getRuntimeClient(
    context.auth.getHeadscaleApiKey(principal, context.oidc?.apiKey),
  );

  const action = formData.get("action_id")?.toString();
  if (!action) {
    throw data("Missing `action_id` in the form data.", {
      status: 400,
    });
  }

  // Fast track register since it doesn't require an existing machine
  if (action === "register") {
    if (!context.auth.can(principal, Capabilities.write_machines)) {
      throw data("You do not have permission to manage machines", {
        status: 403,
      });
    }

    const registrationKey = formData.get("register_key")?.toString();
    if (!registrationKey) {
      throw data("Missing `register_key` in the form data.", {
        status: 400,
      });
    }

    const user = formData.get("user")?.toString();
    if (!user) {
      throw data("Missing `user` in the form data.", {
        status: 400,
      });
    }

    const node = await api.registerNode(user, registrationKey);
    await context.hsLive.refresh(nodesResource, api);
    return redirect(`/machines/${node.id}`);
  }

  // Check if the user has permission to manage this machine
  const nodeId = formData.get("node_id")?.toString();
  if (!nodeId) {
    throw data("Missing `node_id` in the form data.", {
      status: 400,
    });
  }

  const node = await api.getNode(nodeId);
  if (!node) {
    throw data(`Machine with ID ${nodeId} not found`, {
      status: 404,
    });
  }

  if (!context.auth.canManageNode(principal, node)) {
    throw data("You do not have permission to act on this machine", {
      status: 403,
    });
  }

  switch (action) {
    case "rename": {
      const newName = formData.get("name")?.toString();
      if (!newName) {
        throw data("Missing `name` in the form data.", {
          status: 400,
        });
      }

      const name = String(formData.get("name"));
      await api.renameNode(nodeId, name);
      await context.hsLive.refresh(nodesResource, api);
      return { message: "Machine renamed" };
    }

    case "delete": {
      await api.deleteNode(nodeId);
      await context.hsLive.refresh(nodesResource, api);
      return redirect("/machines");
    }

    case "expire": {
      await api.expireNode(nodeId);
      await context.hsLive.refresh(nodesResource, api);
      return { message: "Machine expired" };
    }

    case "update_tags": {
      const tags = formData.get("tags")?.toString().split(",") ?? [];
      if (tags.length === 0) {
        throw data("Missing `tags` in the form data.", {
          status: 400,
        });
      }

      try {
        await api.setNodeTags(
          nodeId,
          tags.map((tag) => tag.trim()).filter((tag) => tag !== ""),
        );

        await context.hsLive.refresh(nodesResource, api);
        return { success: true as const, message: "Tags updated" };
      } catch (error) {
        if (isDataWithApiError(error) && error.data.statusCode === 400) {
          return data(
            {
              success: false as const,
              error:
                "One or more tags are not defined in your ACL policy. Please add them to your policy before assigning them to a machine.",
            },
            { status: 400 },
          );
        }

        throw error;
      }
    }

    case "update_routes": {
      const newApproved = node.approvedRoutes;
      const routes = formData.get("routes")?.toString();
      if (!routes) {
        throw data("Missing `routes` in the form data.", {
          status: 400,
        });
      }

      const allRoutes = routes.split(",").map((route) => route.trim());
      if (allRoutes.length === 0) {
        throw data("No routes provided to update", {
          status: 400,
        });
      }

      const enabled = formData.get("enabled")?.toString();
      if (enabled === undefined) {
        throw data("Missing `enabled` in the form data.", {
          status: 400,
        });
      }

      if (enabled === "true") {
        for (const route of allRoutes) {
          // If already approved, skip, otherwise add to approved
          if (newApproved.includes(route)) {
            continue;
          }

          newApproved.push(route);
        }
      } else {
        for (const route of allRoutes) {
          // If not approved, skip, otherwise remove from approved
          if (!newApproved.includes(route)) {
            continue;
          }

          const index = newApproved.indexOf(route);
          if (index > -1) {
            newApproved.splice(index, 1);
          }
        }
      }

      await api.approveNodeRoutes(nodeId, newApproved);
      await context.hsLive.refresh(nodesResource, api);
      return { message: "Routes updated" };
    }

    case "reassign": {
      const user = formData.get("user_id")?.toString();
      if (!user) {
        throw data("Missing `user_id` in the form data.", {
          status: 400,
        });
      }

      await api.setNodeUser(nodeId, user);
      await context.hsLive.refresh(nodesResource, api);
      return { message: "Machine reassigned" };
    }

    default:
      throw data("Invalid action", {
        status: 400,
      });
  }
}
