import { redirect } from "react-router";
import * as v from "valibot";

import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { nodesResource } from "~/server/headscale/live-store";
import { ActionError, createAction } from "~/server/web/actions";
import { Capabilities } from "~/server/web/roles";
import { invalid, list, ok } from "~/utils/form";
import { normalizeRegistrationKey } from "~/utils/register-key";

import { machineName } from "./schemas";

const nodeId = v.pipe(v.string(), v.minLength(1));
const toggle = v.picklist(["true", "false"]);

export const machineAction = createAction({
  async setup({ request, context }) {
    const { principal, api } = await context.get(requestApiContext)(request);
    const auth = context.get(authContext);
    const liveStore = context.get(headscaleLiveStoreContext);

    async function requireNode(id: string) {
      const node = await api.nodes.get(id);
      if (!node) {
        throw new ActionError("This machine no longer exists.", 404);
      }

      if (!auth.canManageNode(principal, node)) {
        throw new ActionError("You don't have permission to manage this machine.", 403);
      }

      return node;
    }

    return {
      principal,
      api,
      requireNode,
      refresh: () => liveStore.refresh(nodesResource, api),
    };
  },
  intents: {
    register: {
      capability: Capabilities.write_machines,
      fields: {
        register_key: v.pipe(v.string(), v.minLength(1, "Paste the machine key.")),
        user: v.pipe(v.string(), v.minLength(1, "Choose an owner.")),
      },
      async handler(input, { api, refresh }) {
        const registrationKey = normalizeRegistrationKey(input.register_key);
        if (!registrationKey) {
          return invalid({
            register_key:
              "Paste the registration URL or full hskey-authreq-... key from tailscale up.",
          });
        }

        const node = await api.nodes.register(input.user, registrationKey);
        await refresh();
        return redirect(`/machines/${node.id}`);
      },
    },
    rename: {
      fields: { node_id: nodeId, name: machineName },
      async handler(input, { api, requireNode, refresh }) {
        const node = await requireNode(input.node_id);
        await api.nodes.rename(node.id, input.name);
        await refresh();
        return ok("Machine renamed");
      },
    },
    delete: {
      fields: { node_id: nodeId },
      async handler(input, { api, requireNode, refresh }) {
        const node = await requireNode(input.node_id);
        await api.nodes.delete(node.id);
        await refresh();
        return redirect("/machines");
      },
    },
    expire: {
      fields: { node_id: nodeId },
      async handler(input, { api, requireNode, refresh }) {
        const node = await requireNode(input.node_id);
        await api.nodes.expire(node.id);
        await refresh();
        return ok("Machine expired");
      },
    },
    toggle_expiry: {
      fields: { node_id: nodeId, disable_expiry: toggle },
      async handler(input, { api, requireNode, refresh }) {
        const node = await requireNode(input.node_id);
        const disableExpiry = input.disable_expiry === "true";
        await api.nodes.toggleExpiry(node.id, disableExpiry);
        await refresh();
        return ok(disableExpiry ? "Key expiry disabled" : "Key expiry enabled");
      },
    },
    update_tags: {
      fields: { node_id: nodeId, tags: list() },
      async handler(input, { api, requireNode, refresh }) {
        const node = await requireNode(input.node_id);
        const tags = input.tags.map((tag) => tag.trim()).filter((tag) => tag !== "");
        await api.nodes.setTags(node.id, tags);
        await refresh();
        return ok("Tags updated");
      },
    },
    update_routes: {
      fields: { node_id: nodeId, routes: list(), enabled: toggle },
      async handler(input, { api, requireNode, refresh }) {
        const node = await requireNode(input.node_id);
        const routes = input.routes.map((route) => route.trim()).filter((route) => route !== "");
        const approved =
          input.enabled === "true"
            ? [...new Set([...node.approvedRoutes, ...routes])]
            : node.approvedRoutes.filter((route) => !routes.includes(route));

        await api.nodes.approveRoutes(node.id, approved);
        await refresh();
        return ok("Routes updated");
      },
    },
    reassign: {
      fields: {
        node_id: nodeId,
        user_id: v.pipe(v.string(), v.minLength(1, "Choose an owner.")),
      },
      async handler(input, { api, requireNode, refresh }) {
        const node = await requireNode(input.node_id);
        if (!api.nodes.reassignUser) {
          throw new ActionError(
            "Changing a machine's owner isn't supported on this Headscale version.",
          );
        }

        await api.nodes.reassignUser(node.id, input.user_id);
        await refresh();
        return ok("Owner changed");
      },
    },
  },
});
