import { CircleUser } from "lucide-react";

import StatusCircle from "~/components/status-circle";
import type { Role } from "~/server/web/roles";
import cn from "~/utils/cn";

import type { HeadplaneUserData } from "../overview";
import MenuOptions from "./menu";

interface HeadplaneUserRowProps {
  user: HeadplaneUserData;
  headscaleUsers: { id: string; name: string; claimed: boolean }[];
  isSelf?: boolean;
  isOwner?: boolean;
}

export default function HeadplaneUserRow({
  user,
  headscaleUsers,
  isSelf,
  isOwner,
}: HeadplaneUserRowProps) {
  const isOnline = user.machines.some((machine) => machine.online);
  const lastSeen = user.machines.reduce(
    (acc, machine) => Math.max(acc, new Date(machine.lastSeen).getTime()),
    0,
  );

  const displayName = user.linkedHeadscaleUser?.displayName || user.name || user.email || user.sub;
  const displayEmail = user.linkedHeadscaleUser?.email ?? user.email;

  return (
    <tr className="group hover:bg-mist-50 dark:hover:bg-mist-950" key={user.id}>
      <td className="py-2 pl-0.5">
        <div className="flex items-center">
          {user.profilePicUrl ? (
            <img alt={displayName} className="h-10 w-10 rounded-full" src={user.profilePicUrl} />
          ) : (
            <CircleUser className="h-10 w-10" />
          )}
          <div className="ml-4">
            <p className="leading-snug font-semibold">{displayName}</p>
            {displayEmail && <p className="text-sm opacity-50">{displayEmail}</p>}
            {!user.headscaleUserId && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Not linked</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-2 pl-0.5">
        <p>{mapRoleToName(user.role)}</p>
      </td>
      <td className="py-2 pl-0.5">
        <p className="text-sm text-mist-600 dark:text-mist-300" suppressHydrationWarning>
          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
        </p>
      </td>
      <td className="py-2 pl-0.5">
        {user.machines.length > 0 ? (
          <span
            className={cn("flex items-center gap-x-1 text-sm", "text-mist-600 dark:text-mist-300")}
          >
            <StatusCircle className="h-4 w-4" isOnline={isOnline} />
            <p suppressHydrationWarning>
              {isOnline ? "Connected" : new Date(lastSeen).toLocaleString()}
            </p>
          </span>
        ) : (
          <p className="text-sm text-mist-600 dark:text-mist-300">No machines</p>
        )}
      </td>
      <td className="py-2 pr-0.5">
        <MenuOptions
          currentLink={user.headscaleUserId ?? undefined}
          headscaleUsers={headscaleUsers}
          isOwner={isOwner}
          isSelf={isSelf}
          user={user}
        />
      </td>
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
      return <p className="opacity-50">Member</p>;
    default:
      return "Unknown";
  }
}
