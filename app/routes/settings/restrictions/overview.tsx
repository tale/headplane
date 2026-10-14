import { data } from "react-router";

import Callout from "~/components/callout";
import Link from "~/components/link";
import PageHeader from "~/components/page-header";
import { authContext, headscaleConfigContext } from "~/server/context";
import { Capabilities } from "~/server/web/roles";
import { toastClientAction } from "~/utils/toast";

import type { Route } from "./+types/overview";
import { restrictionAction } from "./actions";
import AddRestriction from "./dialogs/add-restriction";
import RestrictionTable from "./table";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const headscaleConfig = context.get(headscaleConfigContext);

  const principal = await auth.require(request);
  const check = auth.can(principal, Capabilities.read_users);
  if (!check) {
    throw data("You do not have permission to view IAM settings.", {
      status: 403,
    });
  }

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
  };
}

export const action = restrictionAction;
export const clientAction = toastClientAction;

export default function Page({ loaderData: { access, writable, settings } }: Route.ComponentProps) {
  const isDisabled = writable ? !access : true;

  return (
    <div className="flex max-w-(--breakpoint-lg) flex-col gap-4">
      <div className="flex w-full flex-col sm:w-2/3">
        <p className="mb-4">
          <Link className="font-medium" to="/settings">
            Settings
          </Link>
          <span className="mx-2">/</span> Authentication Restrictions
        </p>
        <PageHeader
          className="mb-0"
          description={
            <>
              Headscale supports restricting OIDC authentication to only allow certain email
              domains, groups, or users to authenticate. This can be used to limit access to your
              Tailnet to only certain users or groups and Headplane will also respect these settings
              when authenticating.{" "}
              <Link external styled to="https://headscale.net/stable/ref/oidc/#basic-configuration">
                Learn More
              </Link>
            </>
          }
          title="Authentication Restrictions"
        />
        {!access ? (
          <Callout
            className="my-4 max-w-2xl"
            title="Authentication permissions restricted"
            variant="warning"
          >
            You do not have the necessary permissions to edit the Authentication Restrictions
            settings. Please contact your administrator to request access or to make changes to
            these settings.
          </Callout>
        ) : !writable ? (
          <Callout className="my-4 max-w-2xl" title="Configuration Locked" variant="error">
            The Headscale configuration file is not editable through the web interface. Please
            ensure that you have correctly given Headplane write access to the file.
          </Callout>
        ) : undefined}
      </div>
      <RestrictionTable isDisabled={isDisabled} type="domain" values={settings.domains}>
        <AddRestriction isDisabled={isDisabled} type="domain" />
      </RestrictionTable>
      <RestrictionTable isDisabled={isDisabled} type="group" values={settings.groups}>
        <AddRestriction isDisabled={isDisabled} type="group" />
      </RestrictionTable>
      <RestrictionTable isDisabled={isDisabled} type="user" values={settings.users}>
        <AddRestriction isDisabled={isDisabled} type="user" />
      </RestrictionTable>
    </div>
  );
}
