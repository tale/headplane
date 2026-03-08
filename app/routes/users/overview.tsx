import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { useEffect, useState } from "react";

import { users as usersTable } from "~/server/db/schema";
import { getOidcSubject } from "~/server/web/headscale-identity";
import { Capabilities } from "~/server/web/roles";
import type { Machine, User } from "~/types";
import cn from "~/utils/cn";
import { getUserDisplayName } from "~/utils/user";

import type { Route } from "./+types/overview";
import ManageBanner from "./components/manage-banner";
import UserRow from "./components/user-row";
import { userAction } from "./user-actions";

interface UserMachine extends User {
  machines: Machine[];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const principal = await context.auth.require(request);
  const check = await context.auth.can(principal, Capabilities.read_users);
  if (!check) {
    // Not authorized to view this page
    throw new Error(
      "You do not have permission to view this page. Please contact your administrator.",
    );
  }

  const writablePermission = await context.auth.can(principal, Capabilities.write_users);

  const apiKey = context.auth.getHeadscaleApiKey(principal, context.oidc?.apiKey);
  const api = context.hsApi.getRuntimeClient(apiKey);
  const [nodes, apiUsers] = await Promise.all([api.getNodes(), api.getUsers()]);

  const users = apiUsers.map((user) => ({
    ...user,
    machines: nodes.filter((node) => node.user?.id === user.id),
    profilePicUrl:
      context.config.oidc?.profile_picture_source === "gravatar"
        ? (() => {
            if (!user.email) {
              return undefined;
            }

            const emailHash = user.email.trim().toLowerCase();
            const hash = createHash("sha256").update(emailHash).digest("hex");
            return `https://www.gravatar.com/avatar/${hash}?s=200&d=identicon&r=x`;
          })()
        : user.profilePicUrl,
  }));

  const roles = await Promise.all(
    users
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (user) => {
        if (user.provider !== "oidc") {
          return "no-oidc";
        }

        const subject = getOidcSubject(user);
        if (!subject) {
          return "invalid-oidc";
        }

        const role = await context.auth.roleForSubject(subject);
        return role ?? "no-role";
      }),
  );

  let magic: string | undefined;
  if (context.hs.readable()) {
    if (context.hs.c?.dns.magic_dns) {
      magic = context.hs.c.dns.base_domain;
    }
  }

  // Build linkable Headscale users for admin link dialog
  const claimed = await context.auth.claimedHeadscaleUserIds();
  const headscaleUsers = apiUsers.map((u) => ({
    id: u.id,
    name: getUserDisplayName(u),
    claimed: claimed.has(u.id),
  }));

  // Build a map of Headscale user -> linked Headplane subject
  const userLinks: Record<string, string | undefined> = {};
  for (const u of apiUsers) {
    const subject = getOidcSubject(u);
    if (subject) {
      const [hp] = await context.db
        .select({ hsId: usersTable.headscale_user_id })
        .from(usersTable)
        .where(eq(usersTable.sub, subject))
        .limit(1);
      userLinks[u.id] = hp?.hsId ?? undefined;
    }
  }

  return {
    writable: writablePermission, // whether the user can write to the API
    oidc: context.config.oidc
      ? {
          issuer: context.config.oidc.issuer,
        }
      : undefined,
    roles,
    magic,
    users,
    headscaleUsers,
    userLinks,
  };
}

export const action = userAction;

export default function Page({ loaderData }: Route.ComponentProps) {
  const [users, setUsers] = useState<UserMachine[]>(loaderData.users);

  // This useEffect is entirely for the purpose of updating the users when the
  // drag and drop changes the machines between users. It's pretty hacky, but
  // the idea is to treat data.users as the source of truth and update the
  // local state when it changes.
  useEffect(() => {
    setUsers(loaderData.users);
  }, [loaderData.users]);

  return (
    <>
      <h1 className="mb-1.5 text-2xl font-medium">Users</h1>
      <p className="text-md mb-8">Manage the users in your network and their permissions.</p>
      <ManageBanner isDisabled={!loaderData.writable} oidc={loaderData.oidc} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-auto rounded-lg">
          <thead className="text-headplane-600 dark:text-headplane-300">
            <tr className="px-0.5 text-left">
              <th className="pb-2 text-xs font-bold uppercase">User</th>
              <th className="pb-2 text-xs font-bold uppercase">Role</th>
              <th className="pb-2 text-xs font-bold uppercase">Created At</th>
              <th className="pb-2 text-xs font-bold uppercase">Last Seen</th>
            </tr>
          </thead>
          <tbody
            className={cn(
              "divide-y divide-headplane-100 dark:divide-headplane-800 align-top",
              "border-t border-headplane-100 dark:border-headplane-800",
            )}
          >
            {users
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((user) => (
                <UserRow
                  key={user.id}
                  currentLink={loaderData.userLinks[user.id]}
                  headscaleUsers={loaderData.headscaleUsers}
                  role={loaderData.roles[users.indexOf(user)]}
                  user={user}
                />
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
