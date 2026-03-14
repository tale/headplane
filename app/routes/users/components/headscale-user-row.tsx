import { CircleUser } from "lucide-react";

import StatusCircle from "~/components/StatusCircle";
import cn from "~/utils/cn";

import type { UnlinkedHeadscaleUser } from "../overview";

interface HeadscaleUserRowProps {
  user: UnlinkedHeadscaleUser;
}

export default function HeadscaleUserRow({ user }: HeadscaleUserRowProps) {
  const isOnline = user.machines.some((machine) => machine.online);
  const lastSeen = user.machines.reduce(
    (acc, machine) => Math.max(acc, new Date(machine.lastSeen).getTime()),
    0,
  );

  return (
    <tr className="group hover:bg-mist-50 dark:hover:bg-mist-950" key={user.id}>
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
            <p className="leading-snug font-semibold">{user.name || user.displayName}</p>
            {user.email && <p className="text-sm opacity-50">{user.email}</p>}
          </div>
        </div>
      </td>
      <td className="py-2 pl-0.5">
        <p className="text-sm text-mist-600 dark:text-mist-300" suppressHydrationWarning>
          {new Date(user.createdAt).toLocaleDateString()}
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
        {/* Unlinked users only get basic Headscale operations (rename, delete) */}
      </td>
    </tr>
  );
}
