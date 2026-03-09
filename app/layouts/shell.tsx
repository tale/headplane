import { Outlet, redirect } from "react-router";

import Footer from "~/components/Footer";
import Header from "~/components/Header";
import { Capabilities } from "~/server/web/roles";
import { getUserDisplayName } from "~/utils/user";

import { Route } from "./+types/shell";
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
            subject: principal.user.subject,
            name: principal.profile.name,
            email: principal.profile.email,
            username: principal.profile.username,
            picture: principal.profile.picture,
          }
        : { subject: "api_key", name: principal.displayName };

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
        case "Windows":
          osValue = "windows";
          break;
        case "Mac OS X":
          osValue = "macos";
          break;
        case "iPhone":
        case "iPad":
          osValue = "ios";
          break;
        case "Android":
          osValue = "android";
          break;
        default:
          osValue = "linux";
          break;
      }
    }

    return {
      config: context.hs.c,
      url: context.config.headscale.public_url ?? context.config.headscale.url,
      configAvailable: context.hs.readable(),
      debug: context.config.debug,
      user,
      access: {
        ui: check,
        dns: context.auth.can(principal, Capabilities.read_network),
        users: context.auth.can(principal, Capabilities.read_users),
        policy: context.auth.can(principal, Capabilities.read_policy),
        machines: context.auth.can(principal, Capabilities.read_machines),
        settings: context.auth.can(principal, Capabilities.read_feature),
      },
      onboarding: request.url.endsWith("/onboarding"),
      noAccess,
      linkedUserName,
      osValue,
      healthy: await api.isHealthy(),
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
        <Header {...loaderData} />
        <NoAccess linkedUserName={loaderData.linkedUserName} osValue={loaderData.osValue} />
        <Footer {...loaderData} />
      </>
    );
  }

  return (
    <>
      <Header {...loaderData} />
      <Outlet />
      <Footer {...loaderData} />
    </>
  );
}
