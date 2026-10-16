import { Info, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import Code from "~/components/code";
import Input from "~/components/input";
import Link from "~/components/link";
import PageError from "~/components/page-error";
import PageHeader from "~/components/page-header";
import {
  SortHeader,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  type SortDirection,
} from "~/components/table";
import Tooltip from "~/components/tooltip";
import {
  agentsContext,
  appConfigContext,
  authContext,
  headscaleConfigContext,
  headscaleContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import { nodesResource, usersResource } from "~/server/headscale/live-store";
import { latestTailscaleVersion } from "~/server/tailscale-release";
import { isUserPrincipal } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";
import cn from "~/utils/cn";
import {
  extractTagOwnerTags,
  mapNodes,
  sortAssignableTags,
  type PopulatedNode,
} from "~/utils/node-info";
import { toastClientAction } from "~/utils/toast";

import type { Route } from "./+types/overview";
import { MachineFilters } from "./components/machine-filters";
import MachineRow from "./components/machine-row";
import NewMachine from "./dialogs/new";
import { useMachineFilterParams } from "./hooks/use-machine-filter-params";
import { machineAction } from "./machine-actions";

export async function loader({ request, context }: Route.LoaderArgs) {
  const agentsFeature = context.get(agentsContext);
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const getRequestApi = context.get(requestApiContext);
  const headscale = context.get(headscaleContext);
  const headscaleConfig = context.get(headscaleConfigContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const principal = await auth.requireCapability(request, Capabilities.read_machines);

  const writablePermission = auth.can(principal, Capabilities.write_machines);

  const { api } = await getRequestApi(request);
  const [nodesSnap, usersSnap] = await Promise.all([
    headscaleLiveStore.get(nodesResource, api),
    headscaleLiveStore.get(usersResource, api),
  ]);
  const nodes = nodesSnap.data;
  const users = usersSnap.data;

  const magic = headscaleConfig.getMagicDNSBaseDomain();

  const agents = agentsFeature.state === "enabled" ? agentsFeature.value : undefined;
  const [statsResult, policyResult] = await Promise.allSettled([
    agents?.lookup(nodes.map((node) => node.nodeKey)),
    api.policy.get(),
  ]);
  const stats = statsResult.status === "fulfilled" ? statsResult.value : undefined;
  const policy = policyResult.status === "fulfilled" ? policyResult.value.policy : undefined;
  const populatedNodes = mapNodes(nodes, stats);
  const supportsNodeOwnerChange = !headscale.capabilities.nodeOwnerIsImmutable;
  const supportsDisablingKeyExpiry = headscale.capabilities.keyExpiryCanBeDisabled;
  const agentSync = agents?.lastSync();

  return {
    agent: agentSync
      ? {
          syncedAt: agentSync.syncedAt?.toISOString() ?? null,
          nodeCount: agentSync.nodeCount,
          nodeKey: agents?.agentNodeKey(),
        }
      : undefined,
    headscaleUserId: isUserPrincipal(principal) ? principal.user.headscaleUserId : undefined,
    existingTags: sortAssignableTags(nodes, policy),
    latestVersion: agents ? latestTailscaleVersion() : undefined,
    // `undefined` keeps the tag dialog from flagging every tag as undeclared.
    policyTags: extractTagOwnerTags(policy),
    magic,
    nodes,
    populatedNodes,
    preAuth: auth.can(principal, Capabilities.generate_authkeys),
    publicServer: config.headscale.public_url,
    server: config.headscale.url,
    supportsNodeOwnerChange: supportsNodeOwnerChange,
    supportsDisablingKeyExpiry: supportsDisablingKeyExpiry,
    users,
    writable: writablePermission,
  };
}

export const action = machineAction;

export const clientAction = toastClientAction;

type SortField = "name" | "ip" | "version" | "lastSeen";

const STATUS_MATCH: Record<string, (n: PopulatedNode) => boolean> = {
  online: (n) => n.online && !n.expired,
  offline: (n) => !n.online && !n.expired,
  expired: (n) => n.expired,
};

const ROUTE_MATCH: Record<string, (n: PopulatedNode) => boolean> = {
  "exit-node": (n) => n.customRouting.exitRoutes.length > 0,
  subnet: (n) =>
    n.customRouting.subnetApprovedRoutes.length > 0 ||
    n.customRouting.subnetWaitingRoutes.length > 0,
};

export default function Page({ loaderData }: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const searchQuery = searchParams.get("q") ?? "";
  const { filterUser, filterTag, filterStatus, filterRoute, hasActiveFilters } =
    useMachineFilterParams();

  const setSearchQuery = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const v = value.slice(0, 100);
      if (v) next.set("q", v);
      else next.delete("q");
      return next;
    });
  };

  const clearSearch = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("q");
      return next;
    });
  };

  const filteredAndSortedNodes = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    let nodes = loaderData.populatedNodes.filter(
      (node) =>
        (!query ||
          node.givenName.toLowerCase().includes(query) ||
          node.ipAddresses.some((ip) => ip.toLowerCase().includes(query))) &&
        (filterUser === null ||
          (filterUser === "tag-owned" ? !node.user : node.user?.name === filterUser)) &&
        (filterTag === null || (node.tags?.includes(filterTag) ?? false)) &&
        (filterStatus === null || STATUS_MATCH[filterStatus](node)) &&
        (filterRoute === null || ROUTE_MATCH[filterRoute](node)),
    );

    nodes = [...nodes].toSorted((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name": {
          comparison = a.givenName.localeCompare(b.givenName);
          break;
        }
        case "ip": {
          const getIPv4 = (addresses: string[]) =>
            addresses.find((ip) => !ip.includes(":")) || addresses[0] || "";
          const ipA = getIPv4(a.ipAddresses);
          const ipB = getIPv4(b.ipAddresses);

          if (!ipA.includes(":") && !ipB.includes(":")) {
            const octetsA = ipA.split(".").map(Number);
            const octetsB = ipB.split(".").map(Number);
            for (let i = 0; i < 4; i++) {
              if (octetsA[i] !== octetsB[i]) {
                comparison = octetsA[i] - octetsB[i];
                break;
              }
            }
          } else {
            comparison = ipA.localeCompare(ipB);
          }
          break;
        }
        case "version": {
          const versionA = a.hostInfo?.IPNVersion?.split("-")[0] || "0";
          const versionB = b.hostInfo?.IPNVersion?.split("-")[0] || "0";
          const partsA = versionA.split(".").map(Number);
          const partsB = versionB.split(".").map(Number);
          const maxLen = Math.max(partsA.length, partsB.length);

          for (let i = 0; i < maxLen; i++) {
            const segA = partsA[i] || 0;
            const segB = partsB[i] || 0;
            if (segA !== segB) {
              comparison = segA - segB;
              break;
            }
          }
          break;
        }
        case "lastSeen": {
          if (a.online !== b.online) {
            comparison = a.online ? 1 : -1;
            break;
          }
          comparison = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return nodes;
  }, [
    loaderData.populatedNodes,
    searchQuery,
    filterUser,
    filterTag,
    filterStatus,
    filterRoute,
    sortField,
    sortDirection,
  ]);

  const sortProps = { sortField, sortDirection, onSort: handleSort };

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  return (
    <>
      <PageHeader
        actions={
          <NewMachine
            disabledKeys={loaderData.preAuth ? [] : ["pre-auth"]}
            isDisabled={!loaderData.writable}
            server={loaderData.publicServer ?? loaderData.server}
            users={loaderData.users}
          />
        }
        description={
          <>
            Devices connected to your tailnet.{" "}
            <Link external styled to="https://tailscale.com/kb/1372/manage-devices">
              Docs
            </Link>
          </>
        }
        title="Machines"
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-64 max-w-full">
          <Search className="text-faint pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2" />
          <Input
            className="[&_input]:pl-8"
            label="Search machines"
            labelHidden
            maxLength={100}
            onChange={setSearchQuery}
            placeholder="Search by name or IP"
            value={searchQuery}
          />
          {searchQuery && (
            <button
              aria-label="Clear search"
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2",
                "p-1 rounded-full",
                "text-muted hover:text-muted",
                "hover:bg-hover",
              )}
              onClick={clearSearch}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <MachineFilters users={loaderData.users} populatedNodes={loaderData.populatedNodes} />
        <span className="text-muted ml-auto text-xs whitespace-nowrap tabular-nums">
          {searchQuery || hasActiveFilters
            ? `Showing ${filteredAndSortedNodes.length} of ${loaderData.populatedNodes.length} machines`
            : `${loaderData.populatedNodes.length} machines`}
        </span>
      </div>
      <Table>
        <thead>
          <tr>
            <SortHeader field="name" {...sortProps}>
              Name
            </SortHeader>
            <SortHeader
              className="w-1/4"
              field="ip"
              suffix={
                loaderData.magic ? (
                  <span className="ml-1 inline-flex align-middle">
                    <Tooltip
                      content={
                        <span className="font-normal">
                          Since MagicDNS is enabled, you can access devices based on their name and
                          also at <Code>[name].{loaderData.magic}</Code>
                        </span>
                      }
                    >
                      <Info className="size-3.5" />
                    </Tooltip>
                  </span>
                ) : undefined
              }
              {...sortProps}
            >
              Addresses
            </SortHeader>
            {loaderData.agent !== undefined ? (
              <SortHeader field="version" {...sortProps}>
                Version
              </SortHeader>
            ) : undefined}
            <SortHeader field="lastSeen" {...sortProps}>
              Last seen
            </SortHeader>
            <TableHeader className="w-12">
              <span className="sr-only">Actions</span>
            </TableHeader>
          </tr>
        </thead>
        <TableBody>
          {filteredAndSortedNodes.length === 0 ? (
            <tr>
              <TableCell
                className="text-muted py-8 text-center"
                colSpan={loaderData.agent !== undefined ? 5 : 4}
              >
                No machines match the current filters
              </TableCell>
            </tr>
          ) : (
            filteredAndSortedNodes.map((node) => (
              <MachineRow
                existingTags={loaderData.existingTags}
                policyTags={loaderData.policyTags}
                isAgent={
                  loaderData.agent !== undefined
                    ? node.nodeKey === loaderData.agent.nodeKey
                    : undefined
                }
                isDisabled={
                  loaderData.writable
                    ? false // If the user has write permissions, they can edit all machines
                    : node.user?.id !== loaderData.headscaleUserId
                }
                key={node.id}
                latestVersion={loaderData.latestVersion}
                magic={loaderData.magic}
                node={node}
                users={loaderData.users}
                supportsNodeOwnerChange={loaderData.supportsNodeOwnerChange}
                supportsDisablingKeyExpiry={loaderData.supportsDisablingKeyExpiry}
              />
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="machines" />;
}
