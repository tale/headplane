import { Outlet, redirect } from "react-router";

import { ErrorBanner } from "~/components/error-banner";
import { pruneEphemeralNodes } from "~/server/db/pruner";
import { isDataUnauthorizedError } from "~/server/headscale/api/error-client";
import log from "~/utils/log";

import type { Route } from "./+types/dashboard";

export async function loader({ request, context, ...rest }: Route.LoaderArgs) {
  const principal = await context.auth.require(request);
  const apiKey = context.auth.getHeadscaleApiKey(principal, context.oidc?.apiKey);
  const api = context.hsApi.getRuntimeClient(apiKey);

  // MARK: The session should stay valid if Headscale isn't healthy
  const healthy = await api.isHealthy();
  if (healthy) {
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
    healthy,
  };
}

export default function Layout() {
  return (
    <main className="container mt-4 mb-24 overscroll-contain">
      <Outlet />
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <div className="mx-auto my-24 w-fit overscroll-contain">
      <ErrorBanner className="max-w-2xl" error={error} />
    </div>
  );
}
