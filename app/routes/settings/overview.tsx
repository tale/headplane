import { ArrowRight } from "lucide-react";

import Link from "~/components/link";
import PageError from "~/components/page-error";

import type { Route } from "./+types/overview";

export async function loader({ context }: Route.LoaderArgs) {
  const oidcConnector = await context.oidc?.connector.get();
  return {
    config: context.hs.writable(),
    isOidcEnabled: oidcConnector?.isValid ?? false,
  };
}

export default function Page({ loaderData: { config, isOidcEnabled } }: Route.ComponentProps) {
  return (
    <div className="flex max-w-(--breakpoint-lg) flex-col gap-8">
      <div className="flex w-full flex-col sm:w-2/3">
        <h1 className="mb-4 text-2xl font-medium">Settings</h1>
        <p>
          The settings page is still under construction. As I'm able to add more features, I'll be
          adding them here. If you require any features, feel free to open an issue on the GitHub
          repository.
        </p>
      </div>
      <div className="flex w-full flex-col sm:w-2/3">
        <h1 className="mb-4 text-2xl font-medium">Pre-Auth Keys</h1>
        <p>
          Headscale fully supports pre-authentication keys in order to easily add devices to your
          Tailnet. To learn more about using pre-authentication keys, visit the{" "}
          <Link external styled to="https://tailscale.com/kb/1085/auth-keys/">
            Tailscale documentation
          </Link>
        </p>
      </div>
      <Link to="/settings/auth-keys">
        <div className="flex items-center text-lg font-medium">
          Manage Auth Keys
          <ArrowRight className="ml-2 h-5 w-5" />
        </div>
      </Link>
      {config && isOidcEnabled ? (
        <>
          <div className="flex w-full flex-col sm:w-2/3">
            <h1 className="mb-4 text-2xl font-medium">Authentication Restrictions</h1>
            <p>
              Headscale supports restricting OIDC authentication to only allow certain email
              domains, groups, or users to authenticate. This can be used to limit access to your
              Tailnet to only certain users or groups and Headplane will also respect these settings
              when authenticating.{" "}
              <Link external styled to="https://headscale.net/stable/ref/oidc/#basic-configuration">
                Learn More
              </Link>
            </p>
          </div>
          <Link to="/settings/restrictions">
            <div className="flex items-center text-lg font-medium">
              Manage Restrictions
              <ArrowRight className="ml-2 h-5 w-5" />
            </div>
          </Link>
        </>
      ) : undefined}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="Settings" />;
}
