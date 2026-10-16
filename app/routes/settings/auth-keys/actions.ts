import * as v from "valibot";

import { authContext, requestApiContext } from "~/server/context";
import { ActionError, createAction } from "~/server/web/actions";
import { isUserPrincipal } from "~/server/web/auth";
import { getOidcSubject } from "~/server/web/headscale-identity";
import { Capabilities } from "~/server/web/roles";
import type { PreAuthKey } from "~/types";
import { list, ok } from "~/utils/form";

const id = v.pipe(v.string(), v.minLength(1));
const switchValue = v.pipe(
  v.optional(v.string(), ""),
  v.transform((value) => value === "on"),
);

// The form submits the raw value of the number input, so anything that isn't
// a plain integer (locale grouping, unit suffixes) is malformed. Parsing it
// leniently gives an Invalid Date or, for dot-grouping locales, a silently
// truncated expiry.
const expiryDays = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^\d+$/, "Enter a whole number of days."),
  v.transform(Number),
  v.minValue(1, "Enter at least 1 day."),
  v.maxValue(365_000, "Enter at most 365,000 days."),
);

export const authKeysAction = createAction({
  async setup({ request, context }) {
    const auth = context.get(authContext);
    const { principal, api } = await context.get(requestApiContext)(request);
    const canGenerateAny = auth.can(principal, Capabilities.generate_authkeys);
    const canGenerateOwn = auth.can(principal, Capabilities.generate_own_authkeys);
    if (!canGenerateAny && !canGenerateOwn) {
      throw new ActionError("You don't have permission to manage auth keys.", 403);
    }

    async function requireOwnUser(userId: string) {
      if (canGenerateAny) {
        return;
      }

      const [user] = await api.users.list({ id: userId });
      const ownsUser =
        user &&
        isUserPrincipal(principal) &&
        (principal.user.headscaleUserId === userId ||
          getOidcSubject(user) === principal.user.subject);
      if (!ownsUser) {
        throw new ActionError("You can only manage your own auth keys.", 403);
      }
    }

    return { principal, api, requireOwnUser };
  },
  intents: {
    create: {
      fields: {
        user_id: v.optional(v.string()),
        tags: list(),
        expiry: expiryDays,
        reusable: switchValue,
        ephemeral: switchValue,
      },
      async handler(input, { api, requireOwnUser }) {
        const tags = input.tags.map((tag) => tag.trim()).filter((tag) => tag !== "");
        const user = input.user_id || null;
        if (!user && tags.length === 0) {
          throw new ActionError("Choose a user or add at least one tag.");
        }

        if (user) {
          await requireOwnUser(user);
        }

        const expiration = new Date();
        expiration.setDate(expiration.getDate() + input.expiry);

        const key = await api.preAuthKeys.create({
          user,
          ephemeral: input.ephemeral,
          reusable: input.reusable,
          expiration,
          aclTags: tags.length > 0 ? tags : null,
        });

        return ok(undefined, { key: key.key });
      },
    },
    expire: {
      fields: { key_id: id, key: id, user_id: id },
      async handler(input, { api, requireOwnUser }) {
        await requireOwnUser(input.user_id);

        // `user` is the Headscale user id. Before 0.28, expiring posts it as a
        // uint64 read from `key.user?.id`. 0.28 and later only use `key.id`.
        await api.preAuthKeys.expire({
          id: input.key_id,
          key: input.key,
          user: { id: input.user_id },
        } as unknown as PreAuthKey);
        return ok("Auth key expired");
      },
    },
  },
});
