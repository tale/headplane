import { ArrowUp, Copy } from "lucide-react";
import { useMemo } from "react";

import Link from "~/components/link";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "~/components/menu";
import StatusCircle from "~/components/status-circle";
import { TableCell } from "~/components/table";
import { ExitNodeTag } from "~/components/tags/ExitNode";
import { ExpiryTag } from "~/components/tags/Expiry";
import { HeadplaneAgentTag } from "~/components/tags/HeadplaneAgent";
import { SubnetTag } from "~/components/tags/Subnet";
import { TailscaleSSHTag } from "~/components/tags/TailscaleSSH";
import Tooltip from "~/components/tooltip";
import type { User } from "~/types";
import { copyToClipboard } from "~/utils/copy";
import * as hinfo from "~/utils/host-info";
import { isNoExpiry, type PopulatedNode } from "~/utils/node-info";
import { formatTimeDelta } from "~/utils/time";
import toast from "~/utils/toast";
import { getUserDisplayName, isTaggedDevicesUser } from "~/utils/user";

import MenuOptions from "./menu";

interface Props {
  node: PopulatedNode;
  users: User[];
  isAgent?: boolean;
  latestVersion?: string;
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
  latestVersion,
  magic,
  isDisabled,
  existingTags,
  policyTags,
  supportsNodeOwnerChange,
  supportsDisablingKeyExpiry,
}: Props) {
  const uiTags = useMemo(() => uiTagsForNode(node, isAgent), [node, isAgent]);

  const addresses = useMemo(() => {
    const list = node.ipAddresses.map((ip) => ({
      label: ip.includes(":") ? "IPv6" : "IPv4",
      value: ip,
    }));

    list.sort((a, b) => a.label.localeCompare(b.label));
    if (magic) {
      list.push({ label: "MagicDNS", value: `${node.givenName}.${magic}` });
    }

    return list;
  }, [magic, node.givenName, node.ipAddresses]);

  const isConnected = node.online && !node.expired;
  const [ipv4, ipv6] = [
    addresses.find((a) => a.label === "IPv4"),
    addresses.find((a) => a.label === "IPv6"),
  ];

  return (
    <tr className="group">
      <TableCell>
        <Link className="group/link focus-ring rounded-sm" to={`/machines/${node.id}`}>
          <span className="group-hover/link:text-accent flex items-center gap-2 font-medium">
            <StatusCircle isExpired={node.expired} isOnline={isConnected} />
            {node.givenName}
          </span>
        </Link>
        <div className="text-muted mt-0.5 ml-[15px] flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {node.user && !(isTaggedDevicesUser(node.user) && node.tags?.length) ? (
            <span>{getUserDisplayName(node.user)}</span>
          ) : undefined}
          {node.tags?.map((tag) => (
            <span className="font-mono" key={tag}>
              {tag}
            </span>
          ))}
          {mapTagsToComponents(node, uiTags)}
        </div>
      </TableCell>
      <TableCell>
        <Menu>
          <MenuTrigger className="hover:bg-hover -mx-1 -my-0.5 cursor-pointer flex-col items-start rounded-sm px-1 py-0.5 font-mono text-xs leading-5">
            {ipv4 ? (
              <span className="flex items-center gap-1.5">
                {ipv4.value}
                <Copy className="text-muted size-3 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100" />
              </span>
            ) : undefined}
            {ipv6 ? <span className="text-muted">{ipv6.value}</span> : undefined}
          </MenuTrigger>
          <MenuContent>
            {addresses.map(({ label, value }) => (
              <MenuItem
                key={value}
                onClick={async () => {
                  const isCopied = await copyToClipboard(value);
                  toast(isCopied ? `Copied ${value}` : "Copy failed. Copy the address manually.");
                }}
              >
                <div className="flex w-full items-center justify-between gap-x-6">
                  <div>
                    <p className="text-muted text-xs">{label}</p>
                    <p className="font-mono text-sm">{value}</p>
                  </div>
                  <Copy className="text-muted size-3.5" />
                </div>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </TableCell>
      {/* We pass undefined when agents are not enabled */}
      {isAgent !== undefined ? (
        <TableCell className="text-xs leading-5">
          {node.hostInfo !== undefined ? (
            <>
              <p className="flex items-center gap-x-1 font-mono">
                {hinfo.getTSVersion(node.hostInfo)}
                {latestVersion && hinfo.isUpdateAvailable(node.hostInfo, latestVersion) ? (
                  <Tooltip content={`Tailscale ${latestVersion} is available.`}>
                    <span className="bg-warn-subtle text-warn inline-flex size-4 items-center justify-center rounded-full">
                      <ArrowUp
                        aria-label="Update available"
                        className="size-3"
                        strokeWidth={2.75}
                      />
                    </span>
                  </Tooltip>
                ) : undefined}
              </p>
              <p className="text-muted max-w-48 truncate">{hinfo.getOSInfo(node.hostInfo)}</p>
            </>
          ) : (
            <p className="text-muted">Unknown</p>
          )}
        </TableCell>
      ) : undefined}
      <TableCell className="whitespace-nowrap">
        {isConnected ? (
          <span className="text-ok">Connected</span>
        ) : (
          <span
            className="text-muted"
            suppressHydrationWarning
            title={new Date(node.lastSeen).toLocaleString()}
          >
            {formatTimeDelta(new Date(node.lastSeen))}
          </span>
        )}
      </TableCell>
      <TableCell className="align-middle">
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

const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

export function uiTagsForNode(node: PopulatedNode, isAgent?: boolean) {
  const uiTags: string[] = [];
  if (node.expired) {
    uiTags.push("expired");
  }

  if (!node.expired && isNoExpiry(node.expiry)) {
    uiTags.push("no-expiry");
  }

  if (!node.expired && !isNoExpiry(node.expiry)) {
    const remaining = new Date(node.expiry!).getTime() - Date.now();
    if (remaining < EXPIRING_SOON_MS) {
      uiTags.push("expiring");
    }
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
        return (
          <SubnetTag
            count={
              node.customRouting.subnetApprovedRoutes.length +
              node.customRouting.subnetWaitingRoutes.length
            }
            isEnabled={tag === "subnet-approved"}
            key={tag}
          />
        );
      }

      case "expired":
      case "expiring":
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
