import { eq } from "drizzle-orm";
import { redirect } from "react-router";

import { users } from "~/server/db/schema";

import type { Route } from "./+types/onboarding-skip";

export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    const principal = await context.auth.require(request);
    if (principal.kind !== "oidc") {
      return redirect("/machines");
    }

    await context.db
      .update(users)
      .set({ onboarded: true })
      .where(eq(users.sub, principal.user.subject));

    return redirect("/machines");
  } catch {
    return redirect("/login");
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  try {
    const principal = await context.auth.require(request);
    if (principal.kind !== "oidc") {
      return redirect("/machines");
    }

    const formData = await request.formData();
    const headscaleUserId = formData.get("headscale_user_id")?.toString();

    if (headscaleUserId) {
      await context.auth.linkHeadscaleUser(principal.user.id, headscaleUserId);
    }

    await context.db
      .update(users)
      .set({ onboarded: true })
      .where(eq(users.sub, principal.user.subject));

    return redirect("/machines");
  } catch {
    return redirect("/login");
  }
}
