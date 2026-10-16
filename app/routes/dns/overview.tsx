import { useLoaderData } from "react-router";

import Callout from "~/components/callout";
import Link from "~/components/link";
import PageError from "~/components/page-error";
import PageHeader from "~/components/page-header";
import { authContext, headscaleConfigContext } from "~/server/context";
import { Capabilities } from "~/server/web/roles";
import { toastClientAction } from "~/utils/toast";

import type { Route } from "./+types/overview";
import General from "./components/general";
import ManageDomains from "./components/manage-domains";
import ManageNS from "./components/manage-ns";
import ManageRecords from "./components/manage-records";
import { dnsAction } from "./dns-actions";

// We do not want to expose every config value
export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const headscaleConfig = context.get(headscaleConfigContext);

  if (!headscaleConfig.readable()) {
    throw new Error("No configuration is available");
  }

  const principal = await auth.requireCapability(request, Capabilities.read_network);

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
  const isDisabled = data.access === false || data.writable === false;

  return (
    <>
      <PageHeader
        description={
          <>
            Control how devices on your tailnet resolve names.{" "}
            <Link external styled to="https://headscale.net/stable/ref/dns">
              Docs
            </Link>
          </>
        }
        title="DNS"
      />
      <div className="max-w-5xl">
        {isDisabled && (
          <Callout className="mb-6">
            {data.writable
              ? "Your permissions don't allow changes to DNS settings."
              : "The Headscale configuration is read-only, so DNS settings can't be changed here."}
          </Callout>
        )}
        <General
          baseDomain={data.baseDomain}
          isDisabled={isDisabled}
          isMagicDns={data.magicDns}
          isOverrideDns={data.overrideDns}
        />
        <ManageNS global={data.nameservers} isDisabled={isDisabled} split={data.splitDns} />
        <ManageRecords isDisabled={isDisabled} records={data.extraRecords} />
        <ManageDomains
          isDisabled={isDisabled}
          magic={data.magicDns ? data.baseDomain : undefined}
          searchDomains={data.searchDomains}
        />
      </div>
    </>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  return <PageError error={error} page="DNS settings" />;
}
