import Avatar from "~/components/avatar";
import { TableCell } from "~/components/table";
import { formatTimeDelta } from "~/utils/time";

import type { UnlinkedHeadscaleUser } from "../overview";
import HeadscaleUserMenu from "./headscale-user-menu";
import MachinesSeen from "./machines-seen";

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
  const displayName = user.displayName || user.name;
  const displayUsername =
    user.displayName && user.displayName !== user.name ? user.name : undefined;

  return (
    <tr className="group">
      <TableCell>
        <div className="flex items-start gap-3">
          <Avatar name={displayName} src={user.profilePicUrl} />
          <div className="min-w-0">
            <p className="font-medium">{displayName}</p>
            <div className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {displayUsername && <span>{displayUsername}</span>}
              {user.email && <span>{user.email}</span>}
              {user.groups.map((group) => (
                <span className="font-mono" key={group}>
                  {group}
                </span>
              ))}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-muted whitespace-nowrap">
        <span suppressHydrationWarning title={new Date(user.createdAt).toLocaleString()}>
          {formatTimeDelta(new Date(user.createdAt))}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <MachinesSeen machines={user.machines} />
      </TableCell>
      <TableCell className="w-12 text-right align-middle">
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
