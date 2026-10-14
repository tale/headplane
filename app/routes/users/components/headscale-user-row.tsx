import { CircleUser } from "lucide-react";

import Chip from "~/components/chip";
import StatusCircle from "~/components/status-circle";
import { TableCell } from "~/components/table";
import cn from "~/utils/cn";

import type { UnlinkedHeadscaleUser } from "../overview";
import HeadscaleUserMenu from "./headscale-user-menu";

interface HeadscaleUserRowProps {
  user: UnlinkedHeadscaleUser;
  writable?: boolean;
  canEditGroups?: boolean;
  policyGroups?: string[];
  policyHasComments?: boolean;
}

export default function HeadscaleUserRow({
  user,
  writable,
  canEditGroups,
  policyGroups,
  policyHasComments,
}: HeadscaleUserRowProps) {
  const isOnline = user.machines.some((machine) => machine.online);
  const lastSeen = user.machines.reduce(
    (acc, machine) => Math.max(acc, new Date(machine.lastSeen).getTime()),
    0,
  );
  const displayName = user.displayName || user.name;
  const displayUsername =
    user.displayName && user.displayName !== user.name ? user.name : undefined;

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
            {user.email && <p className="text-muted">{user.email}</p>}
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
        <p className="text-muted text-sm" suppressHydrationWarning>
          {new Date(user.createdAt).toLocaleDateString()}
        </p>
      </TableCell>
      <TableCell>
        {user.machines.length > 0 ? (
          <span className={cn("flex items-center gap-x-1 text-sm", "text-muted")}>
            <StatusCircle className="h-4 w-4" isOnline={isOnline} />
            <p suppressHydrationWarning>
              {isOnline ? "Connected" : new Date(lastSeen).toLocaleString()}
            </p>
          </span>
        ) : (
          <p className="text-muted text-sm">No machines</p>
        )}
      </TableCell>
      <TableCell className="pr-0">
        {writable ? (
          <HeadscaleUserMenu
            canEditGroups={canEditGroups}
            policyGroups={policyGroups}
            policyHasComments={policyHasComments}
            user={user}
          />
        ) : null}
      </TableCell>
    </tr>
  );
}
