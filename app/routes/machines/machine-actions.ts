import { data, redirect } from "react-router";

import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { headscaleErrorMessage } from "~/server/headscale/api/error-client";
import { nodesResource } from "~/server/headscale/live-store";
import { Capabilities } from "~/server/web/roles";
import { invalid, ok, parseForm } from "~/utils/form";
import { normalizeRegistrationKey } from "~/utils/register-key";

import type { Route } from "./+types/machine";
import { machineAction as machineActionSchema } from "./schemas";

export async function machineAction({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  const getRequestApi = context.get(requestApiContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const { principal, api } = await getRequestApi(request);
  const form = await parseForm(request, machineActionSchema);
  if (!form.ok) {
    return invalid(form.errors);
  }

  const input = form.data;
  if (input.intent === "register") {
    if (!auth.can(principal, Capabilities.write_machines)) {
      throw data("You do not have permission to manage machines", { status: 403 });
    }

    const registrationKey = normalizeRegistrationKey(input.register_key);
    if (!registrationKey) {
      return invalid({
        register_key: "Paste the registration URL or full hskey-authreq-... key from tailscale up.",
      });
    }

    const node = await api.nodes.register(input.user, registrationKey);
    await headscaleLiveStore.refresh(nodesResource, api);
    return redirect(`/machines/${node.id}`);
  }

  const node = await api.nodes.get(input.node_id);
  if (!node) {
    throw data(`Machine with ID ${input.node_id} not found`, { status: 404 });
  }

  if (!auth.canManageNode(principal, node)) {
    throw data("You do not have permission to act on this machine", { status: 403 });
  }

  try {
    switch (input.intent) {
      case "rename":
        await api.nodes.rename(node.id, input.name);
        await headscaleLiveStore.refresh(nodesResource, api);
        return ok("Machine renamed");

      case "delete":
        await api.nodes.delete(node.id);
        await headscaleLiveStore.refresh(nodesResource, api);
        return redirect("/machines");

      case "expire":
        await api.nodes.expire(node.id);
        await headscaleLiveStore.refresh(nodesResource, api);
        return ok("Machine expired");

      case "toggle_expiry": {
        const disableExpiry = input.disable_expiry === "true";
        await api.nodes.toggleExpiry(node.id, disableExpiry);
        await headscaleLiveStore.refresh(nodesResource, api);
        return ok(disableExpiry ? "Key expiry disabled" : "Key expiry enabled");
      }

      case "update_tags": {
        const tags = input.tags.map((tag) => tag.trim()).filter((tag) => tag !== "");
        await api.nodes.setTags(node.id, tags);
        await headscaleLiveStore.refresh(nodesResource, api);
        return ok("Tags updated");
      }

      case "update_routes": {
        const routes = input.routes.map((route) => route.trim()).filter((route) => route !== "");
        const approved =
          input.enabled === "true"
            ? [...new Set([...node.approvedRoutes, ...routes])]
            : node.approvedRoutes.filter((route) => !routes.includes(route));

        await api.nodes.approveRoutes(node.id, approved);
        await headscaleLiveStore.refresh(nodesResource, api);
        return ok("Routes updated");
      }

      case "reassign":
        if (!api.nodes.reassignUser) {
          return invalid({
            form: "Changing a machine's owner isn't supported on this Headscale version.",
          });
        }

        await api.nodes.reassignUser(node.id, input.user_id);
        await headscaleLiveStore.refresh(nodesResource, api);
        return ok("Owner changed");
    }
  } catch (error) {
    const message = headscaleErrorMessage(error);
    if (message) {
      return invalid({ form: message });
    }

    throw error;
  }
}
