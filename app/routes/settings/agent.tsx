import { useFetcher } from "react-router";

import Button from "~/components/button";
import Callout from "~/components/callout";
import Link from "~/components/link";
import PageHeader from "~/components/page-header";
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
  const isSyncing = fetcher.state !== "idle";

  if (!loaderData.enabled) {
    return (
      <div className="flex max-w-(--breakpoint-lg) flex-col gap-8">
        <PageHeader className="mb-0" title="Headplane Agent" />
        <Callout className="my-4 max-w-2xl" title="Agent Not Enabled">
          {loaderData.reason}. To learn how to set up the agent, visit the{" "}
          <Link external styled to="https://headplane.net/features/agent">
            documentation
          </Link>
        </Callout>
      </div>
    );
  }

  const isPending = !loaderData.syncedAt && loaderData.authUrl;
  const hasError = Boolean(loaderData.error);

  return (
    <div className="flex max-w-(--breakpoint-lg) flex-col gap-8">
      <PageHeader
        className="mb-0"
        description="The Headplane Agent syncs node information like OS version and connectivity details from your Tailnet."
        title="Headplane Agent"
      />

      <div className="flex items-center gap-3">
        <StatusCircle isOnline={!hasError && !isPending} className="h-5 w-5" />
        <span className="text-lg font-medium">
          {hasError ? "Error" : isPending ? "Waiting for approval" : "Healthy"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <p>
          <span className="font-medium">Last synced: </span>
          {loaderData.syncedAt ? (
            <span suppressHydrationWarning>{formatTimeDelta(new Date(loaderData.syncedAt))}</span>
          ) : (
            "Never"
          )}
        </p>
        <p>
          <span className="font-medium">Nodes synced: </span>
          {loaderData.nodeCount}
        </p>
      </div>

      {isPending ? (
        <Callout className="my-4 max-w-2xl" variant="warning" title="Agent Needs Approval">
          The agent is waiting for its Tailnet registration to be approved. Headplane will attempt
          to auto-approve it, but if that fails, you can complete approval by visiting{" "}
          <Link external styled to={loaderData.authUrl!}>
            this link
          </Link>
          .
        </Callout>
      ) : undefined}

      {loaderData.error ? (
        <Callout className="my-4 max-w-2xl" variant="error" title="Sync Error">
          {loaderData.error}
        </Callout>
      ) : undefined}

      <fetcher.Form method="post">
        <Button type="submit" variant="primary" disabled={isSyncing}>
          {isSyncing ? "Syncing…" : "Sync Now"}
        </Button>
      </fetcher.Form>
    </div>
  );
}
