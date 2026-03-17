import { ChevronDown, Copy } from "lucide-react";
import { useMemo } from "react";

import Chip from "~/components/chip";
import Link from "~/components/link";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "~/components/menu";
import StatusCircle from "~/components/status-circle";
import { ExitNodeTag } from "~/components/tags/ExitNode";
import { ExpiryTag } from "~/components/tags/Expiry";
import { HeadplaneAgentTag } from "~/components/tags/HeadplaneAgent";
import { SubnetTag } from "~/components/tags/Subnet";
import { TailscaleSSHTag } from "~/components/tags/TailscaleSSH";
import type { User } from "~/types";
import cn from "~/utils/cn";
import * as hinfo from "~/utils/host-info";
import type { PopulatedNode } from "~/utils/node-info";
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
  supportsNodeOwnerChange: boolean;
}

export default function MachineRow({
  node,
  users,
  isAgent,
  magic,
  isDisabled,
  existingTags,
  supportsNodeOwnerChange,
}: Props) {
  const uiTags = useMemo(() => uiTagsForNode(node, isAgent), [node, isAgent]);

  const ipOptions = useMemo(() => {
    if (magic) {
      return [...node.ipAddresses, `${node.givenName}.${magic}`];
    }

    return node.ipAddresses;
  }, [magic, node.ipAddresses]);

  return (
    <tr className="group hover:bg-mist-50 dark:hover:bg-mist-950" key={node.id}>
      <td className="py-2 pl-0.5 focus-within:ring-3">
        <Link className={cn("group/link h-full focus:outline-hidden")} to={`/machines/${node.id}`}>
          <p
            className={cn(
              "font-semibold leading-snug",
              "group-hover/link:text-blue-600",
              "dark:group-hover/link:text-blue-400",
            )}
          >
            {node.givenName}
          </p>
          <p className="text-sm opacity-50">
            {node.user ? getUserDisplayName(node.user) : "Tag-owned"}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {mapTagsToComponents(node, uiTags)}
            {node.tags?.map((tag) => (
              <Chip key={tag} text={tag} />
            ))}
          </div>
        </Link>
      </td>
      <td className="py-2">
        <div className="flex items-center gap-x-1">
          {node.ipAddresses[0]}
          <Menu>
            <MenuTrigger className="rounded-full bg-transparent p-1 hover:bg-mist-100 dark:hover:bg-mist-800">
              <ChevronDown className="h-4 w-4" />
            </MenuTrigger>
            <MenuContent align="end">
              {ipOptions.map((ip) => (
                <MenuItem
                  key={ip}
                  onClick={async () => {
                    await navigator.clipboard.writeText(ip);
                    toast("Copied IP address to clipboard");
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
      </td>
      {/* We pass undefined when agents are not enabled */}
      {isAgent !== undefined ? (
        <td className="py-2">
          {node.hostInfo !== undefined ? (
            <>
              <p className="leading-snug">{hinfo.getTSVersion(node.hostInfo)}</p>
              <p className="max-w-48 truncate text-sm opacity-50">
                {hinfo.getOSInfo(node.hostInfo)}
              </p>
            </>
          ) : (
            <p className="text-sm opacity-50">Unknown</p>
          )}
        </td>
      ) : undefined}
      <td className="py-2">
        <div className="flex items-start gap-x-1">
          <StatusCircle className="mt-0.5 h-4 w-4" isOnline={node.online && !node.expired} />
          <div>
            <p
              className={cn("text-sm", "text-mist-600 dark:text-mist-300")}
              suppressHydrationWarning
            >
              {node.online && !node.expired
                ? "Connected"
                : new Date(node.lastSeen).toLocaleString()}
            </p>
            {!(node.online && !node.expired) && (
              <p className="text-xs opacity-50" suppressHydrationWarning>
                {formatTimeDelta(new Date(node.lastSeen))}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="py-2 pr-0.5">
        <MenuOptions
          existingTags={existingTags}
          isDisabled={isDisabled}
          magic={magic}
          node={node}
          users={users}
          supportsNodeOwnerChange={supportsNodeOwnerChange}
        />
      </td>
    </tr>
  );
}

export function uiTagsForNode(node: PopulatedNode, isAgent?: boolean) {
  const uiTags: string[] = [];
  if (node.expired) {
    uiTags.push("expired");
  }

  if (node.expiry === null) {
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
