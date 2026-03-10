import { Outlet, redirect } from "react-router";

import Footer from "~/components/Footer";
import Header from "~/layout/header";
import { Capabilities } from "~/server/web/roles";
import { getUserDisplayName } from "~/utils/user";

import type { Route } from "./+types/shell";
import NoAccess from "./no-access";

// This loads the bare minimum for the application to function
// So we know that if context fails to load then well, oops?
export async function loader({ request, context }: Route.LoaderArgs) {
  try {
    const principal = await context.auth.require(request);

    if (
      typeof context.oidc === "object" &&
      principal.kind === "oidc" &&
      !principal.user.onboarded &&
      !request.url.endsWith("/onboarding")
    ) {
      return redirect("/onboarding");
    }

    const apiKey = context.auth.getHeadscaleApiKey(principal, context.oidc?.apiKey);
    const api = context.hsApi.getRuntimeClient(apiKey);
    const check = context.auth.can(principal, Capabilities.ui_access);
    const noAccess = !check && principal.kind === "oidc";

    const user =
      principal.kind === "oidc"
        ? {
            email: principal.profile.email,
            name: principal.profile.name,
            picture: principal.profile.picture,
            subject: principal.user.subject,
            username: principal.profile.username,
          }
        : { name: principal.displayName, subject: "api_key" };

    let linkedUserName: string | undefined;
    let osValue: string | undefined;

    if (noAccess && principal.kind === "oidc") {
      const hsUserId = principal.user.headscaleUserId;
      if (hsUserId) {
        try {
          const apiUsers = await api.getUsers();
          const hsUser = apiUsers.find((u) => u.id === hsUserId);
          linkedUserName = hsUser ? getUserDisplayName(hsUser) : undefined;
        } catch {
          // API unavailable, skip linked user resolution
        }
      }

      const userAgent = request.headers.get("user-agent");
      const os = userAgent?.match(/(Linux|Windows|Mac OS X|iPhone|iPad|Android)/);
      switch (os?.[0]) {
        case "Windows": {
          osValue = "windows";
          break;
        }
        case "Mac OS X": {
          osValue = "macos";
          break;
        }
        case "iPhone":
        case "iPad": {
          osValue = "ios";
          break;
        }
        case "Android": {
          osValue = "android";
          break;
        }
        default: {
          osValue = "linux";
          break;
        }
      }
    }

    return {
      access: {
        ui: check,
        dns: context.auth.can(principal, Capabilities.read_network),
        users: context.auth.can(principal, Capabilities.read_users),
        policy: context.auth.can(principal, Capabilities.read_policy),
        machines: context.auth.can(principal, Capabilities.read_machines),
        settings: context.auth.can(principal, Capabilities.read_feature),
      },
      config: context.hs.c,
      configAvailable: context.hs.readable(),
      debug: context.config.debug,
      healthy: await api.isHealthy(),
      linkedUserName,
      noAccess,
      onboarding: request.url.endsWith("/onboarding"),
      osValue,
      url: context.config.headscale.public_url ?? context.config.headscale.url,
      user,
    };
  } catch {
    return redirect("/login", {
      headers: {
        "Set-Cookie": await context.auth.destroySession(request),
      },
    });
  }
}

export default function Shell({ loaderData }: Route.ComponentProps) {
  if (loaderData.noAccess && !loaderData.onboarding) {
    return (
      <>
        <Header user={loaderData.user} />
        <NoAccess linkedUserName={loaderData.linkedUserName} osValue={loaderData.osValue} />
        <Footer {...loaderData} />
      </>
    );
  }

  return (
    <>
      <Header user={loaderData.user} />
      <Outlet />
      <Footer {...loaderData} />
    </>
  );
}
