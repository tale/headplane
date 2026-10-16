import { useFetcher } from "react-router";

import Button from "~/components/button";
import Callout from "~/components/callout";
import Link from "~/components/link";
import PageError from "~/components/page-error";
import PageHeader from "~/components/page-header";
import Section, { Row, RowList, SettingList, SettingRow } from "~/components/section";
import StatusCircle from "~/components/status-circle";
import {
  agentsContext,
  authContext,
  headscaleContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import { nodesResource } from "~/server/headscale/live-store";
import { Capabilities } from "~/server/web/roles";
import { getTSVersion } from "~/utils/host-info";
import { formatTimeDelta } from "~/utils/time";

import type { Route } from "./+types/agent";

export async function loader({ request, context }: Route.LoaderArgs) {
  const agents = context.get(agentsContext);
  const auth = context.get(authContext);
  const getRequestApi = context.get(requestApiContext);
  const headscale = context.get(headscaleContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  await auth.requireCapability(request, Capabilities.read_machines);

  if (agents.state !== "enabled") {
    return { enabled: false as const, reason: agents.reason };
  }

  // The sync status matters most when Headscale is down, so the page still
  // loads without the machine list.
  const { api } = await getRequestApi(request);
  const [isHealthy, fetched] = await Promise.all([
    headscale.health(),
    headscaleLiveStore
      .get(nodesResource, api)
      .then((snap) => snap.data)
      .catch(() => undefined),
  ]);
  const nodes = fetched ?? [];
  const sync = agents.value.lastSync();
  const selfKey = agents.value.agentNodeKey();
  const self = nodes.find((node) => node.nodeKey === selfKey);
  const others = nodes.filter((node) => node.nodeKey !== selfKey);

  const [selfInfo, updatedAt] = await Promise.all([
    agents.value.lookup(selfKey ? [selfKey] : []),
    agents.value.lastUpdated(others.map((node) => node.nodeKey)),
  ]);

  const synced = new Set(sync.syncedKeys);
  const missing = others
    .filter((node) => !synced.has(node.nodeKey))
    .map((node) => ({
      id: node.id,
      name: node.givenName,
      isOnline: node.online,
      updatedAt: updatedAt[node.nodeKey]?.toISOString() ?? null,
    }));

  return {
    enabled: true as const,
    // The layout already shows a banner when Headscale is down.
    isHeadscaleDown: !isHealthy,
    hasMachines: fetched !== undefined,
    syncedAt: sync.syncedAt?.toISOString() ?? null,
    startedAt: sync.startedAt?.toISOString() ?? null,
    intervalMs: sync.intervalMs,
    consecutiveErrors: sync.consecutiveErrors,
    error: sync.error,
    authUrl: sync.authUrl,
    self: self
      ? {
          id: self.id,
          name: self.givenName,
          isOnline: self.online,
          addresses: self.ipAddresses,
          version: selfKey && selfInfo[selfKey] ? getTSVersion(selfInfo[selfKey]) : undefined,
        }
      : undefined,
    machineCount: others.length,
    missing,
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
        <PageHeader description={description} isSubpage title="Agent" />
        <Callout title="The agent is off">{loaderData.reason}.</Callout>
      </>
    );
  }

  const { self, missing, machineCount, isHeadscaleDown, hasMachines } = loaderData;
  const unavailable = <p className="text-muted py-2.5 text-sm">Unavailable</p>;
  const isPending = !loaderData.syncedAt && Boolean(loaderData.authUrl);
  const hasError = Boolean(loaderData.error);
  const intervalMinutes = Math.max(1, Math.round(loaderData.intervalMs / 60_000));

  return (
    <>
      <PageHeader
        actions={
          <fetcher.Form method="post">
            <Button pending={fetcher.state !== "idle"} type="submit">
              Sync now
            </Button>
          </fetcher.Form>
        }
        description={description}
        isSubpage
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
      {loaderData.error && !isHeadscaleDown && (
        <Callout className="mb-6" title="Sync failed" variant="error">
          {loaderData.error}
        </Callout>
      )}
      <Section title="Sync">
        <SettingList>
          <SettingRow label="Status">
            <span className="flex items-center gap-2">
              <StatusCircle isExpired={hasError} isOnline={!hasError && !isPending} />
              {hasError
                ? `Failing, ${loaderData.consecutiveErrors} ${loaderData.consecutiveErrors === 1 ? "time" : "times"} in a row`
                : isPending
                  ? "Waiting for approval"
                  : "Healthy"}
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
            <span className="text-muted">
              {" "}
              · every {intervalMinutes} {intervalMinutes === 1 ? "minute" : "minutes"}
            </span>
          </SettingRow>
          <SettingRow label="Process">
            {loaderData.startedAt ? (
              <span
                suppressHydrationWarning
                title={new Date(loaderData.startedAt).toLocaleString()}
              >
                Started {formatTimeDelta(new Date(loaderData.startedAt))}
              </span>
            ) : (
              <span className="text-muted">Not running</span>
            )}
          </SettingRow>
        </SettingList>
      </Section>
      <Section
        description="The node the agent uses to reach the rest of your tailnet."
        title="Agent machine"
      >
        {!hasMachines ? (
          unavailable
        ) : self ? (
          <SettingList>
            <SettingRow label="Machine">
              <span className="flex items-center gap-2">
                <StatusCircle isOnline={self.isOnline} />
                <Link styled to={`/machines/${self.id}`}>
                  {self.name}
                </Link>
              </span>
            </SettingRow>
            <SettingRow label="Address">
              <span className="font-mono text-xs">{self.addresses[0] ?? "None"}</span>
            </SettingRow>
            <SettingRow label="Tailscale version">
              <span className="font-mono text-xs">{self.version ?? "Unknown"}</span>
            </SettingRow>
          </SettingList>
        ) : (
          <p className="text-muted py-2.5 text-sm">The agent hasn't joined the tailnet yet.</p>
        )}
      </Section>
      <Section
        description="Machines missing from the last sync keep the details from the last time they were seen, usually because they're offline."
        title="Coverage"
      >
        {!hasMachines ? (
          unavailable
        ) : (
          <p className="py-2.5 text-sm">
            {machineCount - missing.length} of {machineCount}{" "}
            {machineCount === 1 ? "machine" : "machines"} in the last sync
          </p>
        )}
        {missing.length > 0 && (
          <RowList>
            {missing.map((node) => (
              <Row
                action={
                  <span className="text-muted text-sm whitespace-nowrap" suppressHydrationWarning>
                    {node.updatedAt
                      ? `Details from ${formatTimeDelta(new Date(node.updatedAt))}`
                      : "No details yet"}
                  </span>
                }
                key={node.id}
              >
                <span className="flex items-center gap-2 text-sm">
                  <StatusCircle isOnline={node.isOnline} />
                  <Link styled to={`/machines/${node.id}`}>
                    {node.name}
                  </Link>
                </span>
              </Row>
            ))}
          </RowList>
        )}
      </Section>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="the agent" />;
}
