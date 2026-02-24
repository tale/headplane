import { CircleUser } from "lucide-react";

import StatusCircle from "~/components/StatusCircle";
import { Machine, User } from "~/types";
import cn from "~/utils/cn";

import MenuOptions from "./menu";

interface UserRowProps {
  role: string;
  user: User & { machines: Machine[] };
}

export default function UserRow({ user, role }: UserRowProps) {
  const isOnline = user.machines.some((machine) => machine.online);
  const lastSeen = user.machines.reduce(
    (acc, machine) => Math.max(acc, new Date(machine.lastSeen).getTime()),
    0,
  );

  return (
    <tr className="group hover:bg-headplane-50 dark:hover:bg-headplane-950" key={user.id}>
      <td className="py-2 pl-0.5">
        <div className="flex items-center">
          {user.profilePicUrl ? (
            <img
              alt={user.name || user.displayName}
              className="h-10 w-10 rounded-full"
              src={user.profilePicUrl}
            />
          ) : (
            <CircleUser className="h-10 w-10" />
          )}
          <div className="ml-4">
            <p className={cn("font-semibold leading-snug")}>{user.name || user.displayName}</p>
            <p className="text-sm opacity-50">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="py-2 pl-0.5">
        <p>{mapRoleToName(role)}</p>
      </td>
      <td className="py-2 pl-0.5">
        <p className="text-headplane-600 dark:text-headplane-300 text-sm" suppressHydrationWarning>
          {new Date(user.createdAt).toLocaleDateString()}
        </p>
      </td>
      <td className="py-2 pl-0.5">
        <span
          className={cn(
            "flex items-center gap-x-1 text-sm",
            "text-headplane-600 dark:text-headplane-300",
          )}
        >
          <StatusCircle className="h-4 w-4" isOnline={isOnline} />
          <p suppressHydrationWarning>
            {isOnline ? "Connected" : new Date(lastSeen).toLocaleString()}
          </p>
        </span>
      </td>
      <td className="py-2 pr-0.5">
        <MenuOptions user={{ ...user, headplaneRole: role }} />
      </td>
    </tr>
  );
}

function mapRoleToName(role: string) {
  switch (role) {
    case "no-oidc":
      return <p className="opacity-50">Unmanaged</p>;
    case "invalid-oidc":
      return <p className="opacity-50">Invalid</p>;
    case "no-role":
      return <p className="opacity-50">Unregistered</p>;
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
    case "member":
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <span className="text-amber-600 dark:text-amber-400">Pending Approval</span>
        </span>
      );
    default:
      return "Unknown";
  }
}
