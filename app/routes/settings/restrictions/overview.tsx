import { data } from "react-router";

import Callout from "~/components/callout";
import Link from "~/components/link";
import PageError from "~/components/page-error";
import PageHeader from "~/components/page-header";
import { authContext, headscaleConfigContext, integrationContext } from "~/server/context";
import { Capabilities } from "~/server/web/roles";
import { toastClientAction } from "~/utils/toast";

import type { Route } from "./+types/overview";
import { restrictionAction } from "./actions";
import RestrictionSection from "./restriction-section";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const headscaleConfig = context.get(headscaleConfigContext);

  const principal = await auth.requireCapability(request, Capabilities.read_users);

  const oidc = headscaleConfig.getOIDCConfig();
  if (!oidc) {
    throw data("OIDC is not configured on this Headscale instance.", {
      status: 501,
    });
  }

  return {
    access: auth.can(principal, Capabilities.configure_iam),
    settings: {
      domains: [...new Set(oidc.allowedDomains)],
      groups: [...new Set(oidc.allowedGroups)],
      users: [...new Set(oidc.allowedUsers)],
    },
    writable: headscaleConfig.writable(),
    isAutoApplied: context.get(integrationContext) !== undefined,
  };
}

export const action = restrictionAction;
export const clientAction = toastClientAction;

export default function Page({
  loaderData: { access, writable, isAutoApplied, settings },
}: Route.ComponentProps) {
  const isDisabled = !writable || !access;

  return (
    <>
      <PageHeader
        isSubpage
        description={
          <>
            Limit who can sign in through OIDC. Headscale and Headplane both enforce these.{" "}
            <Link external styled to="https://headscale.net/stable/ref/oidc/#basic-configuration">
              Docs
            </Link>
          </>
        }
        title="Sign-in restrictions"
      />
      {isDisabled && (
        <Callout className="mb-6">
          {access
            ? "The Headscale configuration is read-only, so restrictions can't be changed here."
            : "Your permissions don't allow changes to sign-in restrictions."}
        </Callout>
      )}
      {!isDisabled && !isAutoApplied && (
        <Callout className="mb-6" variant="warning">
          Changes are saved to the Headscale configuration but only take effect once Headscale
          restarts. Set up an{" "}
          <Link external styled to="https://headplane.net/configuration/integrations">
            integration
          </Link>{" "}
          to restart it automatically.
        </Callout>
      )}
      <RestrictionSection isDisabled={isDisabled} type="domain" values={settings.domains} />
      <RestrictionSection isDisabled={isDisabled} type="group" values={settings.groups} />
      <RestrictionSection isDisabled={isDisabled} type="user" values={settings.users} />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="sign-in restrictions" />;
}
