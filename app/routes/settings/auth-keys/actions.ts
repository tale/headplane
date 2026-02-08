import { data } from "react-router";

import { Capabilities } from "~/server/web/roles";

import type { Route } from "./+types/overview";

export async function authKeysAction({ request, context }: Route.ActionArgs) {
  const session = await context.sessions.auth(request);
  const check = await context.sessions.check(request, Capabilities.generate_authkeys);

  if (!check) {
    throw data("You do not have permission to manage pre-auth keys", {
      status: 403,
    });
  }

  const formData = await request.formData();
  const api = context.hsApi.getRuntimeClient(session.api_key);
  const action = formData.get("action_id")?.toString();
  if (!action) {
    throw data("Missing `action_id` in the form data.", {
      status: 400,
    });
  }

  switch (action) {
    case "add_preauthkey": {
      const user = formData.get("user_id")?.toString();
      if (!user) {
        return data("Missing `user_id` in the form data.", {
          status: 400,
        });
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

      // Extract the first "word" from expiry which is the day number
      // Calculate the date X days from now using the day number
      const day = Number(expiry.toString().split(" ")[0]);
      const date = new Date();
      date.setDate(date.getDate() + day);
      const key = await api.createPreAuthKey(
        user,
        ephemeral === "on",
        reusable === "on",
        date,
        [], // TODO
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

      await api.expirePreAuthKey(user, key);
      return data("Pre-auth key expired");
    }
    default:
      return data("Invalid action", {
        status: 400,
      });
  }
}
