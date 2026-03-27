import { useFetcher } from "react-router";

import Button from "~/components/button";
import Link from "~/components/link";
import Notice from "~/components/notice";
import StatusCircle from "~/components/status-circle";
import Text from "~/components/text";
import Title from "~/components/title";
import { formatTimeDelta } from "~/utils/time";

import type { Route } from "./+types/agent";

export async function loader({ request, context }: Route.LoaderArgs) {
  const principal = await context.auth.require(request);

  if (!context.agents) {
    return { enabled: false as const };
  }

  const sync = context.agents.lastSync();
  return {
    enabled: true as const,
    syncedAt: sync.syncedAt?.toISOString() ?? null,
    nodeCount: sync.nodeCount,
    error: sync.error,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  await context.auth.require(request);

  if (!context.agents) {
    return { success: false, error: "Agent is not enabled" };
  }

  await context.agents.triggerSync();
  const sync = context.agents.lastSync();
  return { success: !sync.error, error: sync.error };
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const isSyncing = fetcher.state !== "idle";

  if (!loaderData.enabled) {
    return (
      <div className="flex max-w-(--breakpoint-lg) flex-col gap-8">
        <Title>Headplane Agent</Title>
        <Notice title="Agent Not Enabled">
          The Headplane Agent is not enabled. To learn how to set up the agent, visit the{" "}
          <Link external styled to="https://headplane.dev/docs/agent">
            documentation
          </Link>
        </Notice>
      </div>
    );
  }

  const hasError = Boolean(loaderData.error);

  return (
    <div className="flex max-w-(--breakpoint-lg) flex-col gap-8">
      <div className="flex w-full flex-col sm:w-2/3">
        <Title>Headplane Agent</Title>
        <Text>
          The Headplane Agent syncs node information like OS version and connectivity details from
          your Tailnet.
        </Text>
      </div>

      <div className="flex items-center gap-3">
        <StatusCircle isOnline={!hasError} className="h-5 w-5" />
        <span className="text-lg font-medium">{hasError ? "Error" : "Healthy"}</span>
      </div>

      <div className="flex flex-col gap-2">
        <Text>
          <span className="font-medium">Last synced: </span>
          {loaderData.syncedAt ? (
            <span suppressHydrationWarning>{formatTimeDelta(new Date(loaderData.syncedAt))}</span>
          ) : (
            "Never"
          )}
        </Text>
        <Text>
          <span className="font-medium">Nodes synced: </span>
          {loaderData.nodeCount}
        </Text>
      </div>

      {loaderData.error ? (
        <Notice variant="error" title="Sync Error">
          {loaderData.error}
        </Notice>
      ) : undefined}

      <fetcher.Form method="post">
        <Button type="submit" variant="heavy" disabled={isSyncing}>
          {isSyncing ? "Syncing…" : "Sync Now"}
        </Button>
      </fetcher.Form>
    </div>
  );
}
