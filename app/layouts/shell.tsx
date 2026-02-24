import { eq } from "drizzle-orm";
import { Outlet, redirect } from "react-router";

import Footer from "~/components/Footer";
import Header from "~/components/Header";
import { users } from "~/server/db/schema";
import { Capabilities } from "~/server/web/roles";

import { Route } from "./+types/shell";

// This loads the bare minimum for the application to function
// So we know that if context fails to load then well, oops?
export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    const session = await context.sessions.auth(request);
    if (
      typeof context.oidc === "object" &&
      session.user.subject !== "unknown-non-oauth" &&
      !request.url.endsWith("/onboarding")
    ) {
      const [user] = await context.db
        .select()
        .from(users)
        .where(eq(users.sub, session.user.subject))
        .limit(1);

      if (!user?.onboarded) {
        return redirect("/onboarding");
      }
    }

    const api = context.hsApi.getRuntimeClient(session.api_key);
    const check = await context.sessions.check(request, Capabilities.ui_access);

    // Redirect OIDC users without UI access to the pending approval page
    if (
      !check &&
      session.user.subject !== "unknown-non-oauth" &&
      !request.url.endsWith("/onboarding")
    ) {
      return redirect("/pending-approval");
    }

    return {
      config: context.hs.c,
      url: context.config.headscale.public_url ?? context.config.headscale.url,
      configAvailable: context.hs.readable(),
      debug: context.config.debug,
      user: session.user,
      uiAccess: check,
      access: {
        ui: await context.sessions.check(request, Capabilities.ui_access),
        dns: await context.sessions.check(request, Capabilities.read_network),
        users: await context.sessions.check(request, Capabilities.read_users),
        policy: await context.sessions.check(request, Capabilities.read_policy),
        machines: await context.sessions.check(request, Capabilities.read_machines),
        settings: await context.sessions.check(request, Capabilities.read_feature),
      },
      onboarding: request.url.endsWith("/onboarding"),
      healthy: await api.isHealthy(),
    };
  } catch {
    return redirect("/login", {
      headers: {
        "Set-Cookie": await context.sessions.destroySession(),
      },
    });
  }
}

export default function Shell({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Header {...loaderData} />
      <Outlet />
      <Footer {...loaderData} />
    </>
  );
}
