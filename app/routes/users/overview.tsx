import { createHash } from "node:crypto";

import PageError from "~/components/page-error";
import {
  appConfigContext,
  authContext,
  headscaleConfigContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import { nodesResource, usersResource } from "~/server/headscale/live-store";
import { isUserPrincipal } from "~/server/web/auth";
import { Capabilities, Roles } from "~/server/web/roles";
import type { Role } from "~/server/web/roles";
import type { Machine, User } from "~/types";
import { groupsForUser, parsePolicy } from "~/utils/acl-policy";
import cn from "~/utils/cn";
import log from "~/utils/log";
import { getUserDisplayName } from "~/utils/user";

import type { Route } from "./+types/overview";
import HeadplaneUserRow from "./components/headplane-user-row";
import HeadscaleUserRow from "./components/headscale-user-row";
import ManageBanner from "./components/manage-banner";
import { userAction } from "./user-actions";

export interface HeadplaneUserData {
  id: string;
  sub: string;
  name: string | null;
  email: string | null;
  role: Role;
  headscaleUserId: string | null;
  createdAt: Date | null;
  lastLoginAt: Date | null;
  // Enriched from Headscale API (may be absent if API failed)
  linkedHeadscaleUser?: User;
  machines: Machine[];
  profilePicUrl?: string;
  // ACL groups the linked Headscale user belongs to
  groups: string[];
}

export interface UnlinkedHeadscaleUser extends User {
  machines: Machine[];
  // ACL groups this user belongs to
  groups: string[];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const getRequestApi = context.get(requestApiContext);
  const headscaleConfig = context.get(headscaleConfigContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const principal = await auth.require(request);
  const check = await auth.can(principal, Capabilities.read_users);
  if (!check) {
    throw new Error(
      "You do not have permission to view this page. Please contact your administrator.",
    );
  }

  const writablePermission = await auth.can(principal, Capabilities.write_users);

  // Primary data: Headplane users from the database (always available)
  const hpUsers = await auth.listUsers();

  // Secondary data: Headscale API (may fail)
  let apiUsers: User[] = [];
  let nodes: Machine[] = [];
  let apiError: string | undefined;
  let policyGroups: string[] = [];
  let groupsByUser = new Map<string, string[]>();
  // Whether the policy can actually be written. `write_policy` is a role
  // capability; in `file` mode Headscale refuses the write regardless.
  let policyWritable = false;
  let policyHasComments = false;

  try {
    const { api } = await getRequestApi(request);
    const [nodesSnap, usersSnap] = await Promise.all([
      headscaleLiveStore.get(nodesResource, api),
      headscaleLiveStore.get(usersResource, api),
    ]);
    nodes = nodesSnap.data;
    apiUsers = usersSnap.data;

    // ACL groups are stored in the policy, so they are fetched separately and
    // treated as optional: a missing or unreadable policy just hides the UI.
    try {
      const { policy, updatedAt } = await api.policy.get();
      // Same signal the Access Control page uses: a null `updatedAt` means
      // Headscale is in `file` mode and will reject any write.
      policyWritable = updatedAt !== null;
      const parsed = parsePolicy(policy);
      if (parsed.ok) {
        policyHasComments = parsed.hasComments;
        policyGroups = Object.keys(parsed.policy.groups).sort();
        groupsByUser = new Map(
          apiUsers.map((user) => [user.name, groupsForUser(parsed.policy, user.name)]),
        );
      }
    } catch (error) {
      log.warn("api", "Failed to read the ACL policy for groups: %s", String(error));
    }
  } catch (error) {
    log.warn("api", "Failed to fetch Headscale API data: %s", String(error));
    apiError =
      "Could not connect to the Headscale API. Headscale user data and machine information are unavailable.";
  }

  const useGravatar = config.oidc?.profile_picture_source === "gravatar";

  function resolveProfilePic(email?: string, profilePicUrl?: string): string | undefined {
    if (!useGravatar) return profilePicUrl;
    if (!email) return undefined;
    const hash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
    return `https://www.gravatar.com/avatar/${hash}?s=200&d=identicon&r=x`;
  }

  // Build a lookup from Headscale user ID → Headscale user
  const hsUserMap = new Map<string, User>();
  for (const u of apiUsers) {
    hsUserMap.set(u.id, u);
  }

  // Build the primary user list: Headplane users enriched with Headscale data
  const headplaneUsers: HeadplaneUserData[] = hpUsers
    .sort((a, b) => (a.name ?? a.sub).localeCompare(b.name ?? b.sub))
    .map((hp) => {
      const hsUser = hp.headscale_user_id ? hsUserMap.get(hp.headscale_user_id) : undefined;
      const machines = hsUser ? nodes.filter((n) => n.user?.id === hsUser.id) : [];

      return {
        id: hp.id,
        sub: hp.sub,
        name: hp.name,
        email: hp.email,
        role: (hp.role in Roles ? hp.role : "member") as Role,
        headscaleUserId: hp.headscale_user_id,
        createdAt: hp.created_at,
        lastLoginAt: hp.last_login_at,
        linkedHeadscaleUser: hsUser,
        machines,
        profilePicUrl: hsUser
          ? resolveProfilePic(hsUser.email, hsUser.profilePicUrl)
          : resolveProfilePic(hp.email ?? undefined),
        groups: hsUser ? (groupsByUser.get(hsUser.name) ?? []) : [],
      };
    });

  // Build the unlinked Headscale users list
  const claimedIds = new Set(hpUsers.map((u) => u.headscale_user_id).filter(Boolean));
  const unlinkedHeadscaleUsers: UnlinkedHeadscaleUser[] = apiUsers
    .filter((u) => !claimedIds.has(u.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((u) => ({
      ...u,
      machines: nodes.filter((n) => n.user?.id === u.id),
      profilePicUrl: resolveProfilePic(u.email, u.profilePicUrl),
      groups: groupsByUser.get(u.name) ?? [],
    }));

  // Build linkable Headscale users for admin link dialog
  const headscaleUsersForLink = apiUsers.map((u) => ({
    id: u.id,
    name: getUserDisplayName(u),
    claimed: claimedIds.has(u.id),
  }));

  const magic = headscaleConfig.getMagicDNSBaseDomain();

  const isOwner = isUserPrincipal(principal) && principal.user.role === "owner";

  return {
    writable: writablePermission,
    canEditGroups:
      writablePermission && auth.can(principal, Capabilities.write_policy) && policyWritable,
    policyGroups,
    policyHasComments,
    currentUserId: isUserPrincipal(principal) ? principal.user.id : undefined,
    isOwner,
    oidc: config.oidc ? { issuer: config.oidc.issuer } : undefined,
    magic,
    apiError,
    headplaneUsers,
    unlinkedHeadscaleUsers,
    headscaleUsersForLink,
  };
}

export const action = userAction;

export default function Page({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <h1 className="mb-1.5 text-2xl font-medium">Users</h1>
      <p className="text-md mb-8">Manage the users in your network and their permissions.</p>
      <ManageBanner isDisabled={!loaderData.writable} oidc={loaderData.oidc} />

      {loaderData.apiError && (
        <div
          className={cn(
            "mb-6 flex items-start gap-3 rounded-lg border p-4",
            "border-red-200 bg-red-50 text-red-800",
            "dark:border-red-800 dark:bg-red-950 dark:text-red-200",
          )}
        >
          <p className="text-sm">{loaderData.apiError}</p>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Headplane Users</h2>
        {loaderData.headplaneUsers.length === 0 ? (
          <p className="text-sm text-mist-600 dark:text-mist-300">
            No users have signed into Headplane yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-auto rounded-lg">
              <thead className="text-mist-600 dark:text-mist-300">
                <tr className="px-0.5 text-left">
                  <th className="pb-2 text-xs font-bold uppercase">User</th>
                  <th className="pb-2 text-xs font-bold uppercase">Role</th>
                  <th className="pb-2 text-xs font-bold uppercase">Last Login</th>
                  <th className="pb-2 text-xs font-bold uppercase">Status</th>
                  <th className="w-12 pb-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody
                className={cn(
                  "divide-y divide-mist-100 dark:divide-mist-800 align-top",
                  "border-t border-mist-100 dark:border-mist-800",
                )}
              >
                {loaderData.headplaneUsers.map((user) => (
                  <HeadplaneUserRow
                    canEditGroups={loaderData.canEditGroups}
                    isSelf={user.id === loaderData.currentUserId}
                    isOwner={loaderData.isOwner}
                    key={user.id}
                    headscaleUsers={loaderData.headscaleUsersForLink}
                    policyGroups={loaderData.policyGroups}
                    policyHasComments={loaderData.policyHasComments}
                    user={user}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!loaderData.apiError && loaderData.unlinkedHeadscaleUsers.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 text-lg font-medium">Unlinked Headscale Users</h2>
          <p className="mb-3 text-sm text-mist-600 dark:text-mist-300">
            These Headscale users are not linked to a Headplane account and cannot be managed
            through Headplane.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-auto rounded-lg">
              <thead className="text-mist-600 dark:text-mist-300">
                <tr className="px-0.5 text-left">
                  <th className="pb-2 text-xs font-bold uppercase">User</th>
                  <th className="pb-2 text-xs font-bold uppercase">Created At</th>
                  <th className="pb-2 text-xs font-bold uppercase">Status</th>
                  <th className="w-12 pb-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody
                className={cn(
                  "divide-y divide-mist-100 dark:divide-mist-800 align-top",
                  "border-t border-mist-100 dark:border-mist-800",
                )}
              >
                {loaderData.unlinkedHeadscaleUsers.map((user) => (
                  <HeadscaleUserRow
                    canEditGroups={loaderData.canEditGroups}
                    key={user.id}
                    policyGroups={loaderData.policyGroups}
                    policyHasComments={loaderData.policyHasComments}
                    user={user}
                    writable={loaderData.writable}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="Users" />;
}
