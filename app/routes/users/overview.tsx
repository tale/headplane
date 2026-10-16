import { createHash } from "node:crypto";

import Callout from "~/components/callout";
import Link from "~/components/link";
import PageError from "~/components/page-error";
import PageHeader from "~/components/page-header";
import { Table, TableBody, TableHeader } from "~/components/table";
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
import log from "~/utils/log";
import { toastClientAction } from "~/utils/toast";
import { getUserDisplayName } from "~/utils/user";

import type { Route } from "./+types/overview";
import HeadplaneUserRow from "./components/headplane-user-row";
import HeadscaleUserRow from "./components/headscale-user-row";
import CreateUser from "./dialogs/create-user";
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
  groups: string[];
}

export interface UnlinkedHeadscaleUser extends User {
  machines: Machine[];
  groups: string[];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const getRequestApi = context.get(requestApiContext);
  const headscaleConfig = context.get(headscaleConfigContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const principal = await auth.requireCapability(request, Capabilities.read_users);
  const writablePermission = auth.can(principal, Capabilities.write_users);

  // Primary data: Headplane users from the database (always available)
  const hpUsers = await auth.listUsers();

  // Secondary data: Headscale API (may fail)
  let apiUsers: User[] = [];
  let nodes: Machine[] = [];
  let apiError: string | undefined;
  let policyGroups: string[] = [];
  let groupsByUser = new Map<string, string[]>();
  // `write_policy` is a role capability; `file` mode refuses the write anyway.
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

    // Groups live in the policy, so an unreadable one just hides the UI.
    try {
      const { policy, updatedAt } = await api.policy.get();
      // Same signal as the Access Control page: null means `file` mode.
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

export const clientAction = toastClientAction;

export default function Page({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader
        actions={
          <CreateUser isDisabled={!loaderData.writable} isOidc={loaderData.oidc !== undefined} />
        }
        description={
          loaderData.oidc ? (
            <>
              People who can sign in to Headplane, managed through your{" "}
              <Link external styled to={loaderData.oidc.issuer}>
                OIDC provider
              </Link>
              .
            </>
          ) : (
            <>
              People in your tailnet, managed locally.{" "}
              <Link external styled to="https://headscale.net/stable/ref/oidc">
                Set up OIDC
              </Link>
            </>
          )
        }
        title="Users"
      />

      {loaderData.apiError && (
        <Callout className="mb-6" variant="error">
          {loaderData.apiError}
        </Callout>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Headplane users</h2>
        {loaderData.headplaneUsers.length === 0 ? (
          <p className="text-muted text-sm">No users have signed into Headplane yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <TableHeader>User</TableHeader>
                <TableHeader>Role</TableHeader>
                <TableHeader>Last login</TableHeader>
                <TableHeader>Last seen</TableHeader>
                <TableHeader className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHeader>
              </tr>
            </thead>
            <TableBody>
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
            </TableBody>
          </Table>
        )}
      </section>

      {!loaderData.apiError && loaderData.unlinkedHeadscaleUsers.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold">Unlinked Headscale users</h2>
          <p className="text-muted mb-2 text-sm">
            These Headscale users have no Headplane account, so Headplane can't manage their access.
          </p>
          <Table>
            <thead>
              <tr>
                <TableHeader>User</TableHeader>
                <TableHeader>Created</TableHeader>
                <TableHeader>Last seen</TableHeader>
                <TableHeader className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHeader>
              </tr>
            </thead>
            <TableBody>
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
            </TableBody>
          </Table>
        </section>
      )}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="users" />;
}
