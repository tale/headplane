import * as v from "valibot";

import { machineName } from "~/routes/machines/schemas";
import { authContext, headscaleLiveStoreContext, requestApiContext } from "~/server/context";
import { isDataWithApiError } from "~/server/headscale/api/error-client";
import { nodesResource } from "~/server/headscale/live-store";
import { ActionError, createAction } from "~/server/web/actions";
import { isUserPrincipal } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";
import { ok } from "~/utils/form";

const nodeId = v.pipe(v.string(), v.minLength(1));

const expiryDays = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^\d+$/, "Enter a whole number of days."),
  v.transform(Number),
  v.minValue(1, "Enter at least 1 day."),
  v.maxValue(365_000, "Enter at most 365,000 days."),
);

const switchValue = v.pipe(
  v.optional(v.string(), ""),
  v.transform((value) => value === "on"),
);

export const dashboardAction = createAction({
  async setup({ request, context }) {
    const auth = context.get(authContext);
    const { principal, api } = await context.get(requestApiContext)(request);
    const liveStore = context.get(headscaleLiveStoreContext);

    const canWrite =
      auth.can(principal, Capabilities.write_own_machines) ||
      auth.can(principal, Capabilities.write_machines);

    if (!canWrite) {
      throw new ActionError("You don't have permission to do this.", 403);
    }

    // Fetch the node and assert the caller owns it.
    async function requireOwnNode(id: string) {
      const node = await api.nodes.get(id).catch((error: unknown) => {
        if (isDataWithApiError(error) && error.data.statusCode === 404) {
          throw new ActionError("This machine no longer exists.", 404);
        }
        throw error;
      });

      const hsUserId = isUserPrincipal(principal) ? principal.user.headscaleUserId : undefined;
      if (!hsUserId || node.user?.id !== hsUserId) {
        throw new ActionError("You don't have permission to manage this machine.", 403);
      }

      return node;
    }

    return {
      principal,
      api,
      auth,
      requireOwnNode,
      refresh: () => liveStore.refresh(nodesResource, api),
    };
  },
  intents: {
    rename: {
      fields: { node_id: nodeId, name: machineName },
      async handler(input, { requireOwnNode, api, refresh }) {
        const node = await requireOwnNode(input.node_id);
        await api.nodes.rename(node.id, input.name);
        await refresh();
        return ok("Machine renamed");
      },
    },
    delete: {
      fields: { node_id: nodeId },
      async handler(input, { requireOwnNode, api, refresh }) {
        const node = await requireOwnNode(input.node_id);
        await api.nodes.delete(node.id);
        await refresh();
        return ok("Machine removed");
      },
    },
    create_key: {
      fields: {
        expiry: expiryDays,
        reusable: switchValue,
        ephemeral: switchValue,
      },
      // api is forwarded from setup() context, so this is safe.
      async handler(input, { principal, api }) {
        let hsUserId: string | null = null;
        if (isUserPrincipal(principal)) {
          hsUserId = principal.user.headscaleUserId ?? null;
        }

        if (!hsUserId) {
          throw new ActionError(
            "Your account isn't linked to a Headscale user yet. Ask an administrator to link it.",
            403,
          );
        }

        const expiration = new Date();
        expiration.setDate(expiration.getDate() + input.expiry);

        const key = await api.preAuthKeys.create({
          user: hsUserId,
          ephemeral: input.ephemeral,
          reusable: input.reusable,
          expiration,
          aclTags: null,
        });

        return ok(undefined, { key: key.key });
      },
    },
  },
});
