import { CircleUser } from "lucide-react";

import Chip from "~/components/chip";
import StatusCircle from "~/components/status-circle";
import { TableCell } from "~/components/table";
import type { Role } from "~/server/web/roles";
import cn from "~/utils/cn";

import type { HeadplaneUserData } from "../overview";
import MenuOptions from "./menu";

interface HeadplaneUserRowProps {
  user: HeadplaneUserData;
  headscaleUsers: { id: string; name: string; claimed: boolean }[];
  isSelf?: boolean;
  isOwner?: boolean;
  canEditGroups?: boolean;
  policyGroups?: string[];
  policyHasComments?: boolean;
}

export default function HeadplaneUserRow({
  user,
  headscaleUsers,
  isSelf,
  isOwner,
  canEditGroups,
  policyGroups,
  policyHasComments,
}: HeadplaneUserRowProps) {
  const isOnline = user.machines.some((machine) => machine.online);
  const lastSeen = user.machines.reduce(
    (acc, machine) => Math.max(acc, new Date(machine.lastSeen).getTime()),
    0,
  );

  const displayName = user.linkedHeadscaleUser?.displayName || user.name || user.email || user.sub;
  const displayUsername =
    user.linkedHeadscaleUser?.displayName &&
    user.linkedHeadscaleUser.displayName !== user.linkedHeadscaleUser.name
      ? user.linkedHeadscaleUser.name
      : undefined;
  const displayEmail = user.linkedHeadscaleUser?.email ?? user.email;

  return (
    <tr className="group" key={user.id}>
      <TableCell>
        <div className="flex items-center">
          {user.profilePicUrl ? (
            <img alt={displayName} className="h-10 w-10 rounded-full" src={user.profilePicUrl} />
          ) : (
            <CircleUser className="h-10 w-10" />
          )}
          <div className="ml-4">
            <p className="leading-snug font-semibold">{displayName}</p>
            {displayUsername && <p className="text-muted">{displayUsername}</p>}
            {displayEmail && <p className="text-muted">{displayEmail}</p>}
            {!user.headscaleUserId && <p className="text-warn text-xs">Not linked</p>}
            {user.groups.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {user.groups.map((group) => (
                  <Chip className="font-mono" key={group} text={group} />
                ))}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p>{mapRoleToName(user.role)}</p>
      </TableCell>
      <TableCell>
        <p className="text-muted text-sm" suppressHydrationWarning>
          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
        </p>
      </TableCell>
      <TableCell>
        {user.machines.length > 0 ? (
          <span className={cn("flex items-center gap-x-2 text-sm", "text-muted")}>
            <StatusCircle isOnline={isOnline} />
            <p suppressHydrationWarning>
              {isOnline ? "Connected" : new Date(lastSeen).toLocaleString()}
            </p>
          </span>
        ) : (
          <p className="text-muted text-sm">No machines</p>
        )}
      </TableCell>
      <TableCell className="pr-0">
        <MenuOptions
          canEditGroups={canEditGroups}
          currentLink={user.headscaleUserId ?? undefined}
          headscaleUsers={headscaleUsers}
          isOwner={isOwner}
          isSelf={isSelf}
          policyGroups={policyGroups}
          policyHasComments={policyHasComments}
          user={user}
        />
      </TableCell>
    </tr>
  );
}

function mapRoleToName(role: Role) {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "network_admin":
      return "Network Admin";
    case "it_admin":
      return "IT Admin";
    case "auditor":
      return "Auditor";
    case "viewer":
      return "Viewer";
    case "member":
      return <p className="text-muted">Member</p>;
    default:
      return "Unknown";
  }
}
