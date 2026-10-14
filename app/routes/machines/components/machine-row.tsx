import { ChevronDown, Copy } from "lucide-react";
import { useMemo } from "react";

import Chip from "~/components/chip";
import Link from "~/components/link";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "~/components/menu";
import StatusCircle from "~/components/status-circle";
import { TableCell } from "~/components/table";
import { ExitNodeTag } from "~/components/tags/ExitNode";
import { ExpiryTag } from "~/components/tags/Expiry";
import { HeadplaneAgentTag } from "~/components/tags/HeadplaneAgent";
import { SubnetTag } from "~/components/tags/Subnet";
import { TailscaleSSHTag } from "~/components/tags/TailscaleSSH";
import type { User } from "~/types";
import cn from "~/utils/cn";
import { copyToClipboard } from "~/utils/copy";
import * as hinfo from "~/utils/host-info";
import { isNoExpiry, type PopulatedNode } from "~/utils/node-info";
import { formatTimeDelta } from "~/utils/time";
import toast from "~/utils/toast";
import { getUserDisplayName } from "~/utils/user";

import MenuOptions from "./menu";

interface Props {
  node: PopulatedNode;
  users: User[];
  isAgent?: boolean;
  magic?: string;
  isDisabled?: boolean;
  existingTags?: string[];
  policyTags?: string[];
  supportsNodeOwnerChange: boolean;
  supportsDisablingKeyExpiry: boolean;
}

export default function MachineRow({
  node,
  users,
  isAgent,
  magic,
  isDisabled,
  existingTags,
  policyTags,
  supportsNodeOwnerChange,
  supportsDisablingKeyExpiry,
}: Props) {
  const uiTags = useMemo(() => uiTagsForNode(node, isAgent), [node, isAgent]);

  const ipOptions = useMemo(() => {
    if (magic) {
      return [...node.ipAddresses, `${node.givenName}.${magic}`];
    }

    return node.ipAddresses;
  }, [magic, node.ipAddresses]);

  return (
    <tr className="group" key={node.id}>
      <TableCell>
        <Link className="group/link focus-ring rounded-sm" to={`/machines/${node.id}`}>
          <p className="group-hover/link:text-accent font-medium">{node.givenName}</p>
          <p className="text-muted">{node.user ? getUserDisplayName(node.user) : "Tag-owned"}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {mapTagsToComponents(node, uiTags)}
            {node.tags?.map((tag) => (
              <Chip key={tag} text={tag} />
            ))}
          </div>
        </Link>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-x-1 font-mono">
          {node.ipAddresses[0]}
          <Menu>
            <MenuTrigger className="text-muted hover:bg-hover hover:text-fg w-auto rounded-sm p-0.5">
              <ChevronDown className="size-3.5" />
            </MenuTrigger>
            <MenuContent align="end">
              {ipOptions.map((ip) => (
                <MenuItem
                  key={ip}
                  onClick={async () => {
                    const isCopied = await copyToClipboard(ip);
                    toast(
                      isCopied
                        ? "Copied IP address to clipboard"
                        : "Copy failed. Please copy the address manually.",
                    );
                  }}
                >
                  <div
                    className={cn("flex items-center justify-between", "text-sm w-full gap-x-6")}
                  >
                    {ip}
                    <Copy className="h-3 w-3" />
                  </div>
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        </div>
      </TableCell>
      {/* We pass undefined when agents are not enabled */}
      {isAgent !== undefined ? (
        <TableCell>
          {node.hostInfo !== undefined ? (
            <>
              <p>{hinfo.getTSVersion(node.hostInfo)}</p>
              <p className="text-muted max-w-48 truncate">{hinfo.getOSInfo(node.hostInfo)}</p>
            </>
          ) : (
            <p className="text-muted">Unknown</p>
          )}
        </TableCell>
      ) : undefined}
      <TableCell>
        <div className="flex items-start gap-x-1">
          <StatusCircle className="mt-0.5 h-4 w-4" isOnline={node.online && !node.expired} />
          <div>
            <p className="text-muted" suppressHydrationWarning>
              {node.online && !node.expired
                ? "Connected"
                : new Date(node.lastSeen).toLocaleString()}
            </p>
            {!(node.online && !node.expired) && (
              <p className="text-muted text-xs" suppressHydrationWarning>
                {formatTimeDelta(new Date(node.lastSeen))}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="pr-0">
        <MenuOptions
          existingTags={existingTags}
          policyTags={policyTags}
          isDisabled={isDisabled}
          magic={magic}
          node={node}
          users={users}
          supportsNodeOwnerChange={supportsNodeOwnerChange}
          supportsDisablingKeyExpiry={supportsDisablingKeyExpiry}
        />
      </TableCell>
    </tr>
  );
}

export function uiTagsForNode(node: PopulatedNode, isAgent?: boolean) {
  const uiTags: string[] = [];
  if (node.expired) {
    uiTags.push("expired");
  }

  if (!node.expired && isNoExpiry(node.expiry)) {
    uiTags.push("no-expiry");
  }

  if (node.customRouting.exitRoutes.length > 0) {
    if (node.customRouting.exitApproved) {
      uiTags.push("exit-approved");
    } else {
      uiTags.push("exit-waiting");
    }
  }

  if (node.customRouting.subnetWaitingRoutes.length > 0) {
    uiTags.push("subnet-waiting");
  } else if (node.customRouting.subnetApprovedRoutes.length > 0) {
    uiTags.push("subnet-approved");
  }

  if (node.hostInfo?.sshHostKeys && node.hostInfo?.sshHostKeys.length > 0) {
    uiTags.push("tailscale-ssh");
  }

  if (isAgent === true) {
    uiTags.push("headplane-agent");
  }

  return uiTags;
}

export function mapTagsToComponents(node: PopulatedNode, uiTags: string[]) {
  return uiTags.map((tag) => {
    switch (tag) {
      case "exit-approved":
      case "exit-waiting": {
        return <ExitNodeTag isEnabled={tag === "exit-approved"} key={tag} />;
      }

      case "subnet-approved":
      case "subnet-waiting": {
        return <SubnetTag isEnabled={tag === "subnet-approved"} key={tag} />;
      }

      case "expired":
      case "no-expiry": {
        return <ExpiryTag expiry={node.expiry ?? undefined} key={tag} variant={tag} />;
      }

      case "tailscale-ssh": {
        return <TailscaleSSHTag key={tag} />;
      }

      case "headplane-agent": {
        return <HeadplaneAgentTag key={tag} />;
      }

      default: {
        return null;
      }
    }
  });
}
