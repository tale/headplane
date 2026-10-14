import { useMemo, useState } from "react";
import { data } from "react-router";

import Attribute from "~/components/attribute";
import Button from "~/components/button";
import Link from "~/components/link";
import PageHeader from "~/components/page-header";
import StatusCircle from "~/components/status-circle";
import {
  agentsContext,
  headscaleConfigContext,
  headscaleContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import { nodesResource, usersResource } from "~/server/headscale/live-store";
import { getOSInfo, getTSVersion } from "~/utils/host-info";
import { extractTagOwnerTags, isNoExpiry, mapNodes, sortAssignableTags } from "~/utils/node-info";
import { toastClientAction } from "~/utils/toast";
import { getUserDisplayName, isTaggedDevicesUser } from "~/utils/user";

import type { Route } from "./+types/machine";
import { mapTagsToComponents, uiTagsForNode } from "./components/machine-row";
import MenuOptions from "./components/menu";
import Routes from "./dialogs/routes";
import { machineAction } from "./machine-actions";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const agentsFeature = context.get(agentsContext);
  const getRequestApi = context.get(requestApiContext);
  const headscale = context.get(headscaleContext);
  const headscaleConfig = context.get(headscaleConfigContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  if (!params.id) {
    throw new Error("No machine ID provided");
  }

  if (params.id.endsWith(".ico")) {
    throw data(null, { status: 204 });
  }

  const magic = headscaleConfig.getMagicDNSBaseDomain();

  const { api } = await getRequestApi(request);
  const [nodesSnap, usersSnap] = await Promise.all([
    headscaleLiveStore.get(nodesResource, api),
    headscaleLiveStore.get(usersResource, api),
  ]);
  const nodes = nodesSnap.data;
  const users = usersSnap.data;
  const node = nodes.find((node) => node.id === params.id);
  if (node == null) {
    throw data(null, { status: 404 });
  }

  const agents = agentsFeature.state === "enabled" ? agentsFeature.value : undefined;
  const [lookup, policyResult] = await Promise.allSettled([
    agents?.lookup([node.nodeKey]),
    api.policy.get(),
  ]);
  const stats = lookup.status === "fulfilled" ? lookup.value : undefined;
  const [enhancedNode] = mapNodes([node], stats);
  const tags = [...node.tags].toSorted();
  const supportsNodeOwnerChange = !headscale.capabilities.nodeOwnerIsImmutable;
  const supportsDisablingKeyExpiry = headscale.capabilities.keyExpiryCanBeDisabled;
  const agentSync = agents?.lastSync();
  const policy = policyResult.status === "fulfilled" ? policyResult.value.policy : undefined;

  return {
    agent: agentSync
      ? {
          syncedAt: agentSync.syncedAt?.toISOString() ?? null,
          nodeCount: agentSync.nodeCount,
          nodeKey: agents?.agentNodeKey(),
        }
      : undefined,
    existingTags: sortAssignableTags(nodes, policy),
    // `undefined` keeps the tag dialog from flagging every tag as undeclared.
    policyTags: extractTagOwnerTags(policy),
    magic,
    node: enhancedNode,
    stats: stats?.[enhancedNode.nodeKey],
    supportsNodeOwnerChange: supportsNodeOwnerChange,
    supportsDisablingKeyExpiry: supportsDisablingKeyExpiry,
    tags,
    users,
  };
}

export const action = machineAction;

export const clientAction = toastClientAction;

export default function Page({
  loaderData: {
    node,
    tags,
    users,
    magic,
    agent,
    stats,
    existingTags,
    policyTags,
    supportsNodeOwnerChange,
    supportsDisablingKeyExpiry,
  },
}: Route.ComponentProps) {
  const [showRouting, setShowRouting] = useState(false);

  const uiTags = useMemo(() => {
    const tags = uiTagsForNode(node, agent?.nodeKey === node.nodeKey);
    return tags;
  }, [node, agent]);

  const { subnetApprovedRoutes, subnetWaitingRoutes, exitRoutes, exitApproved } =
    node.customRouting;
  const exitStatus =
    exitRoutes.length === 0 ? "Not advertised" : exitApproved ? "Approved" : "Waiting for approval";

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-muted mb-3 text-sm">
        <Link className="hover:text-fg" to="/machines">
          Machines
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg">{node.givenName}</span>
      </nav>
      <PageHeader
        actions={
          <MenuOptions
            existingTags={existingTags}
            policyTags={policyTags}
            isFullButton
            magic={magic}
            node={node}
            users={users}
            supportsNodeOwnerChange={supportsNodeOwnerChange}
            supportsDisablingKeyExpiry={supportsDisablingKeyExpiry}
          />
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {node.user && !(isTaggedDevicesUser(node.user) && tags.length) ? (
              <span>{getUserDisplayName(node.user)}</span>
            ) : undefined}
            {tags.map((tag) => (
              <span className="font-mono" key={tag}>
                {tag}
              </span>
            ))}
            {mapTagsToComponents(node, uiTags)}
          </span>
        }
        title={
          <span className="flex items-center gap-2">
            <StatusCircle isExpired={node.expired} isOnline={node.online && !node.expired} />
            {node.givenName}
          </span>
        }
      />
      <Routes isOpen={showRouting} node={node} setIsOpen={setShowRouting} />
      <section className="mb-8">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold">Routing</h2>
            <p className="text-muted text-sm">
              Expose subnets or route all traffic through this machine.{" "}
              <Link external styled to="https://tailscale.com/kb/1019/subnets">
                Docs
              </Link>
            </p>
          </div>
          <Button onClick={() => setShowRouting(true)}>Edit routes</Button>
        </div>
        <dl className="divide-line border-line divide-y border-t">
          <Attribute
            name="Subnet routes"
            tooltip="Traffic to these routes is sent through this machine."
            value={subnetApprovedRoutes.length > 0 ? subnetApprovedRoutes.join("\n") : "None"}
          />
          {subnetWaitingRoutes.length > 0 ? (
            <Attribute
              name="Waiting for approval"
              tooltip="This machine advertises these routes, but they must be approved before traffic is sent to them."
              value={subnetWaitingRoutes.join("\n")}
            />
          ) : undefined}
          <Attribute
            name="Exit node"
            tooltip="Whether this machine can route all internet traffic for your tailnet."
            value={exitStatus}
          />
        </dl>
      </section>
      <section>
        <div className="mb-2">
          <h2 className="font-semibold">Details</h2>
          <p className="text-muted text-sm">
            Information about this machine's network. Useful when debugging connections.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-x-12 lg:grid-cols-2">
          <dl className="divide-line border-line divide-y border-t">
            <Attribute
              name="Owner"
              value={node.user ? getUserDisplayName(node.user) : "Tag-owned"}
            />
            <Attribute name="Machine name" value={node.givenName} />
            <Attribute
              name="OS hostname"
              tooltip="Published by the machine's operating system and used as the default machine name."
              value={node.name}
            />
            {stats ? (
              <>
                <Attribute name="OS" value={getOSInfo(stats)} />
                <Attribute name="Tailscale version" value={getTSVersion(stats)} />
              </>
            ) : undefined}
            <Attribute
              name="ID"
              tooltip="Used to refer to this machine in the Headscale API."
              value={node.id}
            />
            <Attribute
              isCopyable
              name="Node key"
              tooltip="Public key which uniquely identifies this machine."
              value={node.nodeKey}
            />
            <Attribute name="Created" value={new Date(node.createdAt).toLocaleString()} />
            <Attribute
              name="Last seen"
              value={node.online ? "Connected" : new Date(node.lastSeen).toLocaleString()}
            />
            <Attribute
              name="Key expiry"
              value={!isNoExpiry(node.expiry) ? new Date(node.expiry!).toLocaleString() : "Never"}
            />
          </dl>
          <div>
            <dl className="divide-line border-line divide-y border-t">
              <Attribute
                isCopyable
                name="Tailscale IPv4"
                tooltip="This machine's IPv4 address within your tailnet."
                value={getIpv4Address(node.ipAddresses)}
              />
              <Attribute
                isCopyable
                name="Tailscale IPv6"
                tooltip="This machine's IPv6 address within your tailnet. IPv6 works inside the tailnet even if your ISP does not support it."
                value={getIpv6Address(node.ipAddresses)}
              />
              <Attribute
                isCopyable
                name="Short domain"
                tooltip="Machines in your tailnet can reach this one by this name."
                value={node.givenName}
              />
              {magic ? (
                <Attribute
                  isCopyable
                  name="Full domain"
                  tooltip="The fully qualified MagicDNS name for this machine."
                  value={`${node.givenName}.${magic}`}
                />
              ) : undefined}
              {stats?.Endpoints ? (
                <Attribute name="Endpoints" value={stats.Endpoints.join("\n")} />
              ) : undefined}
            </dl>
            {stats ? (
              <>
                <h3 className="text-muted mt-6 mb-1 text-xs font-medium">Connectivity</h3>
                <dl className="divide-line border-line divide-y border-t">
                  <Attribute
                    name="Varies"
                    tooltip="Whether the machine is behind a difficult NAT that changes its IP address depending on the destination."
                    value={stats.NetInfo?.MappingVariesByDestIP ? "Yes" : "No"}
                  />
                  <Attribute
                    name="Hairpinning"
                    tooltip="Whether the machine needs to traverse NATs with hairpinning."
                    value={stats.NetInfo?.HairPinning ? "Yes" : "No"}
                  />
                  <Attribute name="IPv6" value={stats.NetInfo?.WorkingIPv6 ? "Yes" : "No"} />
                  <Attribute name="UDP" value={stats.NetInfo?.WorkingUDP ? "Yes" : "No"} />
                  <Attribute name="UPnP" value={stats.NetInfo?.UPnP ? "Yes" : "No"} />
                  <Attribute name="PCP" value={stats.NetInfo?.PCP ? "Yes" : "No"} />
                  <Attribute name="NAT-PMP" value={stats.NetInfo?.PMP ? "Yes" : "No"} />
                </dl>
              </>
            ) : undefined}
          </div>
        </div>
      </section>
    </>
  );
}

function getIpv4Address(addresses: string[]) {
  for (const address of addresses) {
    if (address.startsWith("100.")) {
      // Return the first CGNAT address
      return address;
    }
  }

  return "—";
}

function getIpv6Address(addresses: string[]) {
  for (const address of addresses) {
    if (address.startsWith("fd")) {
      // Return the first IPv6 address
      return address;
    }
  }

  return "—";
}
