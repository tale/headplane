import type { ActionFunctionArgs } from "react-router";
import * as v from "valibot";

import { authContext } from "~/server/context";
import { headscaleErrorMessage } from "~/server/headscale/api/error-client";
import type { Principal } from "~/server/web/auth";
import type { Capabilities } from "~/server/web/roles";
import { type ActionResult, formValues, invalid, parseValues } from "~/utils/form";

// Every possible action state. If a regular Error is thrown it's a bug
export class ActionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type HandlerResult = ActionResult | Response | ReturnType<typeof invalid>;

interface Intent<E extends v.ObjectEntries, C> {
  fields: E;
  capability?: Capabilities;
  handler: (input: v.InferOutput<v.ObjectSchema<E, undefined>>, ctx: C) => Promise<HandlerResult>;
}

interface ActionOptions<C, T extends Record<string, v.ObjectEntries>> {
  capability?: Capabilities;
  setup: (args: ActionFunctionArgs) => Promise<C>;
  intents: { [K in keyof T]: Intent<T[K], C> };
}

export function createAction<
  C extends { principal: Principal },
  T extends Record<string, v.ObjectEntries>,
>(options: ActionOptions<C, T>) {
  return async (args: ActionFunctionArgs) => {
    const auth = args.context.get(authContext);

    try {
      const ctx = await options.setup(args);
      const values = formValues(await args.request.formData());
      const name = String(values.intent ?? "");

      if (!Object.hasOwn(options.intents, name)) {
        return invalid({ form: "This action isn't supported." });
      }

      const intent = options.intents[name] as Intent<v.ObjectEntries, C>;
      for (const capability of [options.capability, intent.capability]) {
        if (capability !== undefined && !auth.can(ctx.principal, capability)) {
          throw new ActionError("You don't have permission to do this.", 403);
        }
      }

      const parsed = parseValues(v.object(intent.fields), values);
      if (!parsed.ok) {
        return invalid(parsed.errors);
      }

      return await intent.handler(parsed.data, ctx);
    } catch (error) {
      if (error instanceof ActionError) {
        return invalid({ form: error.message }, error.status);
      }

      const message = headscaleErrorMessage(error);
      if (message) {
        return invalid({ form: message });
      }

      throw error;
    }
  };
}
