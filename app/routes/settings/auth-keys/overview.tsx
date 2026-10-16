import { useMemo, useState } from "react";

import Callout from "~/components/callout";
import FilterDropdown from "~/components/filter-dropdown";
import Link from "~/components/link";
import PageError from "~/components/page-error";
import PageHeader from "~/components/page-header";
import { Table, TableBody, TableHeader } from "~/components/table";
import {
  appConfigContext,
  authContext,
  headscaleLiveStoreContext,
  requestApiContext,
} from "~/server/context";
import { usersResource } from "~/server/headscale/live-store";
import { isUserPrincipal } from "~/server/web/auth";
import { Capabilities } from "~/server/web/roles";
import type { PreAuthKey } from "~/types";
import type { User } from "~/types/User";
import log from "~/utils/log";
import { toastClientAction } from "~/utils/toast";
import { getUserDisplayName } from "~/utils/user";

import type { Route } from "./+types/overview";
import { authKeysAction } from "./actions";
import AuthKeyRow from "./auth-key-row";
import AddAuthKey from "./dialogs/add-auth-key";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  const config = context.get(appConfigContext);
  const getRequestApi = context.get(requestApiContext);
  const headscaleLiveStore = context.get(headscaleLiveStoreContext);

  const { principal, api } = await getRequestApi(request);

  const usersSnap = await headscaleLiveStore.get(usersResource, api);
  const users = usersSnap.data;

  let keys: { user: User | null; preAuthKeys: PreAuthKey[] }[];
  let missing: { user: User; error: unknown }[] = [];

  // Try fetching all keys at once (Headscale 0.28+), fall back to per-user
  let allKeys: PreAuthKey[] | null = null;
  if (api.preAuthKeys.listAll) {
    try {
      allKeys = await api.preAuthKeys.listAll();
    } catch {
      // Treat any failure as "no global list available" and fall through.
    }
  }

  if (allKeys !== null) {
    const keysByUser = new Map<string | null, PreAuthKey[]>();
    for (const key of allKeys) {
      const userId = key.user?.id ?? null;
      const existing = keysByUser.get(userId) ?? [];
      existing.push(key);
      keysByUser.set(userId, existing);
    }

    keys = [];
    const tagOnly = keysByUser.get(null);
    if (tagOnly?.length) {
      keys.push({ preAuthKeys: tagOnly, user: null });
    }
    for (const user of users) {
      const userKeys = keysByUser.get(user.id);
      if (userKeys?.length) {
        keys.push({ preAuthKeys: userKeys, user });
      }
    }
  } else {
    type FetchResult =
      | { success: true; user: User; preAuthKeys: PreAuthKey[] }
      | { success: false; user: User; error: unknown; preAuthKeys: [] };

    const results: FetchResult[] = await Promise.all(
      users
        .filter((u) => u.id?.length > 0)
        .map(async (user) => {
          try {
            const preAuthKeys = await api.preAuthKeys.listForUser(user.id);
            return { preAuthKeys, success: true as const, user };
          } catch (error) {
            log.error("api", "GET /v1/preauthkey for %s: %o", user.name, error);
            return { error, preAuthKeys: [] as const, success: false as const, user };
          }
        }),
    );

    keys = results
      .filter(({ success }) => success)
      .map(({ user, preAuthKeys }) => ({ preAuthKeys, user }));

    missing = results
      .filter((r): r is Extract<FetchResult, { success: false }> => !r.success)
      .map(({ user, error }) => ({ error, user }));
  }

  const canGenerateAny = auth.can(principal, Capabilities.generate_authkeys);
  const canGenerateOwn = auth.can(principal, Capabilities.generate_own_authkeys);

  return {
    access: canGenerateAny || canGenerateOwn,
    currentHeadscaleUserId: isUserPrincipal(principal) ? principal.user.headscaleUserId : undefined,
    currentSubject: isUserPrincipal(principal) ? principal.user.subject : undefined,
    keys,
    missing,
    selfServiceOnly: !canGenerateAny && canGenerateOwn,
    url: config.headscale.public_url ?? config.headscale.url,
    users,
  };
}

export const action = authKeysAction;
export const clientAction = toastClientAction;

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "reusable", label: "Reusable" },
  { value: "ephemeral", label: "Ephemeral" },
] as const;

type Status = (typeof STATUS_OPTIONS)[number]["value"];

const TAG_ONLY = "__tag_only";

export default function Page({
  loaderData: {
    keys,
    missing,
    users,
    url,
    access,
    selfServiceOnly,
    currentHeadscaleUserId,
    currentSubject,
  },
}: Route.ComponentProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>("active");
  const allKeys = keys.flatMap(({ preAuthKeys }) => preAuthKeys);

  const userOptions = [
    ...keys
      .filter((k): k is { user: User; preAuthKeys: PreAuthKey[] } => k.user !== null)
      .map(({ user }) => ({ value: user.id, label: getUserDisplayName(user) })),
    ...(keys.some(({ user }) => user === null) ? [{ value: TAG_ONLY, label: "Tags only" }] : []),
  ];

  const filteredKeys = useMemo(() => {
    const now = new Date();
    return keys
      .filter(({ user }) => {
        if (selectedUser === null) {
          return true;
        }

        if (selectedUser === TAG_ONLY) {
          return user === null;
        }

        return user?.id === selectedUser;
      })
      .flatMap(({ preAuthKeys }) => preAuthKeys)
      .filter((key) => {
        const isPastExpiry = new Date(key.expiration) < now;

        switch (status) {
          case null:
            return true;
          case "ephemeral":
            return key.ephemeral;
          case "reusable":
            return key.reusable;
          case "expired":
            return isPastExpiry;
          case "active":
            return !isPastExpiry;
        }
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [keys, selectedUser, status]);

  return (
    <>
      <PageHeader
        isSubpage
        actions={
          access ? (
            <AddAuthKey
              currentHeadscaleUserId={currentHeadscaleUserId}
              currentSubject={currentSubject}
              selfServiceOnly={selfServiceOnly}
              url={url}
              users={users}
            />
          ) : undefined
        }
        description={
          <>
            Register machines without signing in.{" "}
            <Link external styled to="https://tailscale.com/kb/1085/auth-keys/">
              Docs
            </Link>
          </>
        }
        title="Auth keys"
      />
      {!access && (
        <Callout className="mb-6">
          Your permissions don't allow creating auth keys. Ask an administrator to create one for
          you.
        </Callout>
      )}
      {missing.length > 0 && (
        <Callout className="mb-6" title="Some keys couldn't be loaded" variant="error">
          Headplane couldn't fetch the keys for{" "}
          {missing.map(({ user }) => getUserDisplayName(user)).join(", ")}. Check the server logs
          for details.
        </Callout>
      )}
      {allKeys.length === 0 ? (
        <p className="text-muted text-sm">No auth keys yet.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {userOptions.length > 1 && (
              <FilterDropdown
                label="User"
                onChange={setSelectedUser}
                options={userOptions}
                value={selectedUser}
              />
            )}
            <FilterDropdown
              label="Status"
              onChange={(value) => setStatus(value as Status | null)}
              options={STATUS_OPTIONS}
              value={status}
            />
            <span className="text-muted ml-auto text-xs tabular-nums">
              {filteredKeys.length} {filteredKeys.length === 1 ? "key" : "keys"}
            </span>
          </div>
          {filteredKeys.length === 0 ? (
            <p className="text-muted border-line border-t py-2.5 text-sm">
              No keys match these filters.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <TableHeader>Key</TableHeader>
                  <TableHeader>User</TableHeader>
                  <TableHeader>Expires</TableHeader>
                  <TableHeader>Created</TableHeader>
                  <TableHeader className="w-20">
                    <span className="sr-only">Actions</span>
                  </TableHeader>
                </tr>
              </thead>
              <TableBody>
                {filteredKeys.map((key) => {
                  // Headscale reports some users by email instead of id.
                  // https://github.com/juanfont/headscale/issues/2520
                  const user = key.user ? users.find((u) => u.id === key.user?.id) : null;
                  if (user === undefined) {
                    return null;
                  }

                  return <AuthKeyRow authKey={key} key={key.id} user={user} />;
                })}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PageError error={error} page="auth keys" />;
}
