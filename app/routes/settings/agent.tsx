import { useFetcher } from "react-router";

import Button from "~/components/button";
import Callout from "~/components/callout";
import Link from "~/components/link";
import PageHeader from "~/components/page-header";
import { SettingList, SettingRow } from "~/components/section";
import StatusCircle from "~/components/status-circle";
import { agentsContext, authContext } from "~/server/context";
import { formatTimeDelta } from "~/utils/time";

import type { Route } from "./+types/agent";

export async function loader({ request, context }: Route.LoaderArgs) {
  const agents = context.get(agentsContext);
  const auth = context.get(authContext);

  await auth.require(request);

  if (agents.state !== "enabled") {
    return { enabled: false as const, reason: agents.reason };
  }

  const sync = agents.value.lastSync();
  return {
    enabled: true as const,
    syncedAt: sync.syncedAt?.toISOString() ?? null,
    nodeCount: sync.nodeCount,
    error: sync.error,
    authUrl: sync.authUrl,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const agents = context.get(agentsContext);
  const auth = context.get(authContext);

  await auth.require(request);

  if (agents.state !== "enabled") {
    return { success: false, error: agents.reason };
  }

  await agents.value.triggerSync();
  const sync = agents.value.lastSync();
  return {
    success: !sync.error,
    error: sync.error,
    authUrl: sync.authUrl,
  };
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const description = (
    <>
      Syncs each machine's Tailscale version, OS, and connectivity from your tailnet.{" "}
      <Link external styled to="https://headplane.net/features/agent">
        Docs
      </Link>
    </>
  );

  if (!loaderData.enabled) {
    return (
      <>
        <PageHeader isSubpage description={description} title="Agent" />
        <Callout title="The agent is off">{loaderData.reason}.</Callout>
      </>
    );
  }

  const isPending = !loaderData.syncedAt && Boolean(loaderData.authUrl);
  const hasError = Boolean(loaderData.error);

  return (
    <>
      <PageHeader
        isSubpage
        actions={
          <fetcher.Form method="post">
            <Button pending={fetcher.state !== "idle"} type="submit">
              Sync now
            </Button>
          </fetcher.Form>
        }
        description={description}
        title="Agent"
      />
      {isPending && loaderData.authUrl && (
        <Callout className="mb-6" title="Waiting for approval" variant="warning">
          Headplane tries to approve the agent's tailnet registration automatically. If that doesn't
          work,{" "}
          <Link external styled to={loaderData.authUrl}>
            approve it here
          </Link>
          .
        </Callout>
      )}
      {loaderData.error && (
        <Callout className="mb-6" title="Sync failed" variant="error">
          {loaderData.error}
        </Callout>
      )}
      <SettingList>
        <SettingRow label="Status">
          <span className="flex items-center gap-2">
            <StatusCircle isOnline={!hasError && !isPending} />
            {hasError ? "Error" : isPending ? "Waiting for approval" : "Healthy"}
          </span>
        </SettingRow>
        <SettingRow label="Last synced">
          {loaderData.syncedAt ? (
            <span suppressHydrationWarning title={new Date(loaderData.syncedAt).toLocaleString()}>
              {formatTimeDelta(new Date(loaderData.syncedAt))}
            </span>
          ) : (
            <span className="text-muted">Never</span>
          )}
        </SettingRow>
        <SettingRow label="Machines synced">{loaderData.nodeCount}</SettingRow>
      </SettingList>
    </>
  );
}
