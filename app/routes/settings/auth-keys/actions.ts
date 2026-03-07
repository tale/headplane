import { data } from "react-router";

import { Capabilities } from "~/server/web/roles";

import type { Route } from "./+types/overview";

export async function authKeysAction({ request, context }: Route.ActionArgs) {
  const session = await context.sessions.auth(request);
  const api = context.hsApi.getRuntimeClient(session.api_key);

  const canGenerateAny = await context.sessions.check(request, Capabilities.generate_authkeys);
  const canGenerateOwn = await context.sessions.check(request, Capabilities.generate_own_authkeys);

  if (!canGenerateAny && !canGenerateOwn) {
    throw data("You do not have permission to manage pre-auth keys", {
      status: 403,
    });
  }

  const formData = await request.formData();
  const action = formData.get("action_id")?.toString();
  if (!action) {
    throw data("Missing `action_id` in the form data.", {
      status: 400,
    });
  }

  switch (action) {
    case "add_preauthkey": {
      const user = formData.get("user_id")?.toString() || null;
      const aclTagsRaw = formData.get("acl_tags")?.toString() || "";
      const aclTags = aclTagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      if (!user && aclTags.length === 0) {
        return data("Must specify either a user or ACL tags.", {
          status: 400,
        });
      }

      // Only allow self-service users to create keys for themselves
      if (!canGenerateAny && canGenerateOwn && user) {
        const [targetUser] = await api.getUsers(user);
        if (!targetUser) {
          return data("User not found.", { status: 404 });
        }
        const targetSubject = targetUser.providerId?.split("/").pop();
        if (targetSubject !== session.user.subject) {
          throw data("You can only create pre-auth keys for your own user", {
            status: 403,
          });
        }
      }

      const expiry = formData.get("expiry")?.toString();
      if (!expiry) {
        return data("Missing `expiry` in the form data.", {
          status: 400,
        });
      }

      const reusable = formData.get("reusable")?.toString();
      if (!reusable) {
        return data("Missing `reusable` in the form data.", {
          status: 400,
        });
      }

      const ephemeral = formData.get("ephemeral")?.toString();
      if (!ephemeral) {
        return data("Missing `ephemeral` in the form data.", {
          status: 400,
        });
      }

      const day = Number(expiry.toString().split(" ")[0]);
      const date = new Date();
      date.setDate(date.getDate() + day);

      const key = await api.createPreAuthKey(
        user,
        ephemeral === "on",
        reusable === "on",
        date,
        aclTags.length > 0 ? aclTags : null,
      );

      return data({ success: true as const, key: key.key });
    }
    case "expire_preauthkey": {
      const key = formData.get("key")?.toString();
      if (!key) {
        return data("Missing `key` in the form data.", {
          status: 400,
        });
      }

      const user = formData.get("user_id")?.toString();
      if (!user) {
        return data("Missing `user_id` in the form data.", {
          status: 400,
        });
      }

      // Only allow self-service users to expire their own keys
      if (!canGenerateAny && canGenerateOwn) {
        const [targetUser] = await api.getUsers(user);
        if (!targetUser) {
          return data("User not found.", { status: 404 });
        }
        const targetSubject = targetUser.providerId?.split("/").pop();
        if (targetSubject !== session.user.subject) {
          throw data("You can only expire pre-auth keys for your own user", {
            status: 403,
          });
        }
      }

      await api.expirePreAuthKey(user, key);
      return data("Pre-auth key expired");
    }
    default:
      return data("Invalid action", {
        status: 400,
      });
  }
}
