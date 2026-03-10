import { Outlet, redirect } from "react-router";

import { ErrorBanner } from "~/components/error-banner";
import { pruneEphemeralNodes } from "~/server/db/pruner";
import { isDataUnauthorizedError } from "~/server/headscale/api/error-client";
import { Capabilities } from "~/server/web/roles";
import log from "~/utils/log";

import type { Route } from "./+types/app";
import Footer from "./footer";
import Header from "./header";

export async function loader({ request, context, ...rest }: Route.LoaderArgs) {
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

    // MARK: The session should stay valid if Headscale isn't healthy
    const isHealthy = await api.isHealthy();
    if (isHealthy) {
      try {
        await api.getApiKeys();
        await pruneEphemeralNodes({ context, request, ...rest });
      } catch (error) {
        if (isDataUnauthorizedError(error)) {
          const displayName =
            principal.kind === "oidc" ? principal.profile.name : principal.displayName;
          log.warn("auth", "Logging out %s due to expired API key", displayName);
          return redirect("/login", {
            headers: {
              "Set-Cookie": await context.auth.destroySession(request),
            },
          });
        }
      }
    }

    return {
      access: {
        dns: context.auth.can(principal, Capabilities.read_network),
        machines: context.auth.can(principal, Capabilities.read_machines),
        policy: context.auth.can(principal, Capabilities.read_policy),
        settings: context.auth.can(principal, Capabilities.read_feature),
        ui: context.auth.can(principal, Capabilities.ui_access),
        users: context.auth.can(principal, Capabilities.read_users),
      },
      baseUrl: context.config.headscale.public_url ?? context.config.headscale.url,
      configAvailable: context.hs.readable(),
      isDebug: context.config.debug,
      isHealthy,
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

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Header
        access={loaderData.access}
        configAvailable={loaderData.configAvailable}
        user={loaderData.user}
      />
      <main className="container mt-4 mb-24 overscroll-contain">
        <Outlet />
      </main>
      <Footer isDebug={loaderData.isDebug} baseUrl={loaderData.baseUrl} />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <div className="mx-auto my-24 w-fit overscroll-contain">
      <ErrorBanner className="max-w-2xl" error={error} />
    </div>
  );
}
