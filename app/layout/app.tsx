import { Outlet, redirect, type ShouldRevalidateFunction } from "react-router";

import { ErrorBanner } from "~/components/error-banner";
import StatusBanner from "~/components/status-banner";
import { pruneEphemeralNodes } from "~/server/db/pruner";
import { isDataUnauthorizedError } from "~/server/headscale/api/error-client";
import { usersResource } from "~/server/headscale/live-store";
import { Capabilities } from "~/server/web/roles";
import log from "~/utils/log";

import type { Route } from "./+types/app";
import Footer from "./footer";
import Header from "./header";

export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formAction,
  defaultShouldRevalidate,
}) => {
  if (formAction) {
    return defaultShouldRevalidate;
  }

  // Allow programmatic revalidations (e.g. SSE-triggered) where the URL hasn't changed
  if (currentUrl.href === nextUrl.href) {
    return defaultShouldRevalidate;
  }

  return false;
};

export async function loader({ request, context, ...rest }: Route.LoaderArgs) {
  try {
    const principal = await context.auth.require(request);

    const apiKey = context.auth.getHeadscaleApiKey(principal);
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

      // Self-heal: if the linked Headscale user was deleted, clear the
      // stale link so the user gets prompted to re-link.
      if (principal.kind === "oidc" && principal.user.headscaleUserId) {
        try {
          const usersSnap = await context.hsLive.get(usersResource, api);
          if (!usersSnap.data.some((u) => u.id === principal.user.headscaleUserId)) {
            await context.auth.unlinkHeadscaleUser(principal.user.id);
          }
        } catch {
          // API call failed, skip validation
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
        {!loaderData.isHealthy && (
          <StatusBanner
            className="mb-4"
            dismissable={false}
            title="Headscale Unreachable"
            variant="critical"
          >
            Unable to connect to the Headscale server. Data shown may be stale and changes cannot be
            saved until the connection is restored.
          </StatusBanner>
        )}
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
