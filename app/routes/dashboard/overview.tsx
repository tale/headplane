import { Laptop } from "lucide-react";
import { useState } from "react";
import { data } from "react-router";

import Button from "~/components/button";
import Callout from "~/components/callout";
import PageError from "~/components/page-error";
import PageHeader from "~/components/page-header";
import StatusCircle from "~/components/status-circle";
import { Table, TableBody, TableCell, TableHeader } from "~/components/table";
import { authContext, headscaleConfigContext, requestApiContext } from "~/server/context";
import { isUserPrincipal } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";
import type { Machine } from "~/types";
import cn from "~/utils/cn";
import { isNoExpiry } from "~/utils/node-info";
import { toastClientAction } from "~/utils/toast";

import type { Route } from "./+types/overview";
import { dashboardAction } from "./dashboard-actions";
import Delete from "./dialogs/delete";
import GenerateKey from "./dialogs/generate-key";
import Rename from "./dialogs/rename";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const headscaleConfig = context.get(headscaleConfigContext);
  const { principal, api } = await context.get(requestApiContext)(request);

  // Enforces read_own_machines — throws 403 for truly zero-capability sessions.
  await auth.requireCapability(request, Capabilities.read_own_machines);

  if (!isUserPrincipal(principal)) {
    // api_key sessions have ui_access and are redirected by the layout shell;
    // this path is unreachable in practice.
    throw data("API key sessions cannot access the member portal.", { status: 403 });
  }

  const magic = headscaleConfig.getMagicDNSBaseDomain();
  const hsUserId = principal.user.headscaleUserId;

  if (!hsUserId) {
    // Unlinked member: return an empty device list with a banner flag.
    return {
      isLinked: false as const,
      magic,
      nodes: [] as Machine[],
      userName: principal.profile.name,
    };
  }

  // Fetch ALL nodes using the master API key (from requestApiContext), then
  // filter server-side. The filtered slice is all that reaches the client.
  const allNodes = await api.nodes.list();
  const ownNodes = allNodes.filter((n) => n.user?.id === hsUserId);

  return {
    isLinked: true as const,
    magic,
    nodes: ownNodes,
    userName: principal.profile.name,
  };
}

export const action = dashboardAction;
export const clientAction = toastClientAction;

interface NodeRowProps {
  node: Machine;
  magic?: string;
}

function NodeRow({ node, magic }: NodeRowProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const ipv4 = node.ipAddresses.find((ip) => !ip.includes(":"));
  const ipv6 = node.ipAddresses.find((ip) => ip.includes(":"));
  const isExpired = !isNoExpiry(node.expiry) && new Date(node.expiry!) < new Date();
  const isOnline = node.online ?? false;

  return (
    <tr className="border-line hover:bg-subtle border-t">
      <TableCell>
        <div className="flex items-center gap-2">
          <StatusCircle isOnline={isOnline} isExpired={isExpired} />
          <span className="font-medium">{node.givenName}</span>
        </div>
        {magic && (
          <p className="text-muted mt-0.5 ml-4 text-xs">
            {node.givenName}.{magic}
          </p>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5 text-sm tabular-nums">
          {ipv4 && <span>{ipv4}</span>}
          {ipv6 && <span className="text-muted text-xs">{ipv6}</span>}
        </div>
      </TableCell>
      <TableCell>
        <span
          className={cn("text-sm", isExpired ? "text-bad" : isOnline ? "text-ok" : "text-muted")}
        >
          {isExpired ? "Expired" : isOnline ? "Online" : "Offline"}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            aria-label={`Rename ${node.givenName}`}
            onClick={() => setRenameOpen(true)}
            size="sm"
            variant="ghost"
          >
            Rename
          </Button>
          <Button
            aria-label={`Remove ${node.givenName}`}
            onClick={() => setDeleteOpen(true)}
            size="sm"
            variant="ghost"
          >
            Remove
          </Button>
        </div>
        <Rename machine={node} magic={magic} isOpen={renameOpen} setIsOpen={setRenameOpen} />
        <Delete machine={node} isOpen={deleteOpen} setIsOpen={setDeleteOpen} />
      </TableCell>
    </tr>
  );
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { nodes, magic, isLinked, userName } = loaderData;

  return (
    <>
      <PageHeader
        actions={<GenerateKey isDisabled={!isLinked} />}
        description="Devices connected to the network under your account."
        title="My Devices"
      />

      {!isLinked && (
        <Callout className="mb-6" variant="warning" title="Account not linked yet">
          Your Headplane account isn't linked to a Headscale user. Once an administrator links it,
          your devices will appear here and you'll be able to generate pre-auth keys.
        </Callout>
      )}

      {isLinked && nodes.length === 0 ? (
        <div className="border-line flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <Laptop className="text-muted size-8" />
          <div>
            <p className="font-medium">No devices yet</p>
            <p className="text-muted mt-1 text-sm">
              Generate a pre-auth key and run{" "}
              <code className="text-fg">tailscale up --authkey=&lt;key&gt;</code> on a device to
              connect it.
            </p>
          </div>
          <GenerateKey />
        </div>
      ) : nodes.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <TableHeader>Name</TableHeader>
              <TableHeader className="w-40">Addresses</TableHeader>
              <TableHeader className="w-24">Status</TableHeader>
              <TableHeader className="w-36">
                <span className="sr-only">Actions</span>
              </TableHeader>
            </tr>
          </thead>
          <TableBody>
            {nodes.map((node) => (
              <NodeRow key={node.id} node={node} magic={magic} />
            ))}
          </TableBody>
        </Table>
      ) : null}

      {isLinked && nodes.length > 0 && (
        <p className="text-muted mt-4 text-right text-xs tabular-nums">
          {nodes.length} {nodes.length === 1 ? "device" : "devices"} — signed in as{" "}
          <span className="font-medium">{userName}</span>
        </p>
      )}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="dashboard" />;
}
