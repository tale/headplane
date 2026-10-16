import * as v from "valibot";

import { authContext, requestApiContext } from "~/server/context";
import { isDataWithApiError } from "~/server/headscale/api/error-client";
import { ActionError, createAction } from "~/server/web/actions";
import { Capabilities } from "~/server/web/roles";
import { invalid, ok } from "~/utils/form";

// Headscale prefixes policy parse errors with one of these, for HuJSON syntax
// and for the policy structure respectively.
const parseErrorPrefixes = ["parsing HuJSON:", "parsing policy from bytes:"];

export const aclAction = createAction({
  capability: Capabilities.write_policy,
  async setup({ request, context }) {
    const principal = await context.get(authContext).require(request);
    const { api } = await context.get(requestApiContext)(request);
    return { principal, api };
  },
  intents: {
    save: {
      fields: { policy: v.pipe(v.string(), v.nonEmpty("The policy can't be empty.")) },
      async handler(input, { api }) {
        try {
          await api.policy.set(input.policy);
        } catch (error) {
          if (!isDataWithApiError(error)) {
            throw error;
          }

          if (error.data.rawData.includes("update is disabled")) {
            throw new ActionError(
              "The ACL policy is read-only. Set `policy.mode` to `database` in your Headscale configuration to edit it.",
              403,
            );
          }

          const message = error.data.data?.message;
          const prefix = parseErrorPrefixes.find(
            (prefix) => typeof message === "string" && message.includes(prefix),
          );
          if (typeof message === "string" && prefix) {
            const detail = message.slice(message.indexOf(prefix) + prefix.length).trim();
            return invalid({ form: `Syntax error: ${detail}` });
          }

          throw error;
        }

        return ok("Policy updated");
      },
    },
  },
});
