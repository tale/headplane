import { useLoaderData } from "react-router";

import Callout from "~/components/callout";
import Code from "~/components/code";
import PageError from "~/components/page-error";
import PageHeader from "~/components/page-header";
import { authContext, headscaleConfigContext } from "~/server/context";
import { Capabilities } from "~/server/web/roles";
import { toastClientAction } from "~/utils/toast";

import type { Route } from "./+types/overview";
import ManageDomains from "./components/manage-domains";
import ManageNS from "./components/manage-ns";
import ManageRecords from "./components/manage-records";
import RenameTailnet from "./components/rename-tailnet";
import ToggleMagic from "./components/toggle-magic";
import { dnsAction } from "./dns-actions";

// We do not want to expose every config value
export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const headscaleConfig = context.get(headscaleConfigContext);

  if (!headscaleConfig.readable()) {
    throw new Error("No configuration is available");
  }

  const principal = await auth.require(request);
  const check = auth.can(principal, Capabilities.read_network);
  if (!check) {
    // Not authorized to view this page
    throw new Error(
      "You do not have permission to view this page. Please contact your administrator.",
    );
  }

  const writablePermission = auth.can(principal, Capabilities.write_network);

  const dns = headscaleConfig.getDNSConfig();

  return {
    ...dns,
    access: writablePermission,
    writable: headscaleConfig.writable(),
  };
}

export const action = dnsAction;

export const clientAction = toastClientAction;

export default function Page() {
  const data = useLoaderData<typeof loader>();

  const allNs: Record<string, string[]> = {};
  for (const key of Object.keys(data.splitDns)) {
    allNs[key] = data.splitDns[key];
  }

  allNs.global = data.nameservers;
  const isDisabled = data.access === false || data.writable === false;

  return (
    <>
      <PageHeader description="Control how devices on your tailnet resolve names." title="DNS" />
      <div className="flex max-w-(--breakpoint-lg) flex-col gap-16">
        {data.writable ? undefined : (
          <Callout className="my-4 max-w-2xl">
            The Headscale configuration is read-only. You cannot make changes to the configuration
          </Callout>
        )}
        {data.access ? undefined : (
          <Callout className="my-4 max-w-2xl">
            Your permissions do not allow you to modify the DNS settings for this tailnet.
          </Callout>
        )}
        <RenameTailnet isDisabled={isDisabled} name={data.baseDomain} />
        <ManageNS isDisabled={isDisabled} nameservers={allNs} overrideLocalDns={data.overrideDns} />
        <ManageRecords isDisabled={isDisabled} records={data.extraRecords} />
        <ManageDomains
          isDisabled={isDisabled}
          magic={data.magicDns ? data.baseDomain : undefined}
          searchDomains={data.searchDomains}
        />

        <div className="flex w-full flex-col sm:w-2/3">
          <h2 className="mb-4 text-lg font-semibold">Magic DNS</h2>
          <p className="mb-4">
            Automatically register domain names for each device on the tailnet. Devices will be
            accessible at{" "}
            <Code>
              [device].
              {data.baseDomain}
            </Code>{" "}
            when Magic DNS is enabled.
          </p>
          <ToggleMagic isDisabled={isDisabled} isEnabled={data.magicDns} />
        </div>
      </div>
    </>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  return <PageError error={error} page="DNS" />;
}
