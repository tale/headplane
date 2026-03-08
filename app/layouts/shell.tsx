import { Form, Outlet, redirect } from "react-router";

import Button from "~/components/Button";
import Card from "~/components/Card";
import Footer from "~/components/Footer";
import Header from "~/components/Header";
import { Capabilities } from "~/server/web/roles";

import { Route } from "./+types/shell";

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
      pendingApproval: !check && principal.kind === "oidc",
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
  if (loaderData.pendingApproval && !loaderData.onboarding) {
    return (
      <>
        <Header {...loaderData} />
        <main className="container mx-auto mt-4 mb-24 overscroll-contain">
          <div className="mx-auto mt-24 max-w-lg">
            <Card variant="flat">
              <Card.Title className="mb-4">Pending Approval</Card.Title>
              <Card.Text>
                Your account has been created but you don't have access to the UI yet. An
                administrator needs to assign you a role before you can continue.
              </Card.Text>
              <Card.Text className="mt-2">
                If you believe this is a mistake, please contact your administrator.
              </Card.Text>
              <Form action="/logout" className="mt-6" method="POST">
                <Button className="w-full" type="submit" variant="light">
                  Sign out
                </Button>
              </Form>
            </Card>
          </div>
        </main>
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
