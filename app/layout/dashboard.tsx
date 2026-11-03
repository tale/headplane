import { Outlet, redirect } from "react-router";

import PageError from "~/components/page-error";
import { appConfigContext, authContext, requestApiContext } from "~/server/context";
import { isUserPrincipal } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";

import type { Route } from "./+types/dashboard";
import Footer from "./footer";
import Header from "./header";
import Scrollbar from "./scrollbar";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);

  try {
    const { principal } = await context.get(requestApiContext)(request);

    // Users with full ui_access (admin and above) belong in the admin shell.
    if (auth.can(principal, Capabilities.ui_access)) {
      return redirect("/machines");
    }

    // Members without read_own_machines have truly no access.
    if (!auth.can(principal, Capabilities.read_own_machines)) {
      return redirect("/login", {
        headers: { "Set-Cookie": await auth.destroySession(request) },
      });
    }

    const user = isUserPrincipal(principal)
      ? {
          email: principal.profile.email,
          name: principal.profile.name,
          picture: principal.profile.picture,
          subject: principal.user.subject,
          username: principal.profile.username,
        }
      : { name: (principal as { displayName: string }).displayName, subject: "api_key" as const };

    return {
      user,
      baseUrl: config.headscale.public_url ?? config.headscale.url,
      isDebug: config.debug,
    };
  } catch {
    return redirect("/login", {
      headers: { "Set-Cookie": await auth.destroySession(request) },
    });
  }
}

// No nav tabs visible to members — all access flags are false.
const NO_ACCESS = {
  ui: false,
  machines: false,
  dns: false,
  users: false,
  policy: false,
  settings: false,
} as const;

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Header access={NO_ACCESS} configAvailable={false} user={loaderData.user} />
      <main className="container mt-4 mb-24 overscroll-contain">
        <Outlet />
      </main>
      <Footer isDebug={loaderData.isDebug} baseUrl={loaderData.baseUrl} />
      <Scrollbar />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} />;
}
