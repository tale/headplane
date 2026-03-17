import { FileKey2 } from "lucide-react";
import { useMemo, useState } from "react";

import Code from "~/components/Code";
import Link from "~/components/link";
import Notice from "~/components/Notice";
import Select from "~/components/Select";
import TableList from "~/components/TableList";
import { usersResource } from "~/server/headscale/live-store";
import { Capabilities } from "~/server/web/roles";
import type { PreAuthKey } from "~/types";
import type { User } from "~/types/User";
import log from "~/utils/log";
import { getUserDisplayName } from "~/utils/user";

import type { Route } from "./+types/overview";
import { authKeysAction } from "./actions";
import AuthKeyRow from "./auth-key-row";
import AddAuthKey from "./dialogs/add-auth-key";

export async function loader({ request, context }: Route.LoaderArgs) {
  const principal = await context.auth.require(request);
  const apiKey = context.auth.getHeadscaleApiKey(principal, context.oidc?.apiKey);
  const api = context.hsApi.getRuntimeClient(apiKey);

  const usersSnap = await context.hsLive.get(usersResource, api);
  const users = usersSnap.data;

  let keys: { user: User | null; preAuthKeys: PreAuthKey[] }[];
  let missing: { user: User; error: unknown }[] = [];

  // Try fetching all keys at once (Headscale 0.28+), fall back to per-user
  let allKeys: PreAuthKey[] | null = null;
  try {
    allKeys = await api.getAllPreAuthKeys();
  } catch {
    // Older versions don't support this endpoint
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
            const preAuthKeys = await api.getPreAuthKeys(user.id);
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

  const canGenerateAny = context.auth.can(principal, Capabilities.generate_authkeys);
  const canGenerateOwn = context.auth.can(principal, Capabilities.generate_own_authkeys);

  return {
    access: canGenerateAny || canGenerateOwn,
    currentSubject: principal.kind === "oidc" ? principal.user.subject : undefined,
    keys,
    missing,
    selfServiceOnly: !canGenerateAny && canGenerateOwn,
    url: context.config.headscale.public_url ?? context.config.headscale.url,
    users,
  };
}

export const action = authKeysAction;

type Status = "all" | "active" | "expired" | "reusable" | "ephemeral";
export default function Page({
  loaderData: { keys, missing, users, url, access, selfServiceOnly, currentSubject },
}: Route.ComponentProps) {
  const [selectedUser, setSelectedUser] = useState("__headplane_all");
  const [status, setStatus] = useState<Status>("active");
  const isDisabled = !access || keys.flatMap(({ preAuthKeys }) => preAuthKeys).length === 0;

  const filteredKeys = useMemo(() => {
    const now = new Date();
    return keys
      .filter(({ user }) => {
        if (selectedUser === "__headplane_all") {
          return true;
        }

        if (selectedUser === "__headplane_tag_only") {
          return user === null;
        }

        return user?.id === selectedUser;
      })
      .flatMap(({ preAuthKeys }) => preAuthKeys)
      .filter((key) => {
        if (status === "all") {
          return true;
        }

        if (status === "ephemeral") {
          return key.ephemeral;
        }

        if (status === "reusable") {
          return key.reusable;
        }

        const expiry = new Date(key.expiration);
        if (status === "expired") {
          // Expired keys are either used or expired
          // BUT only used if they are not reusable
          if (key.used && !key.reusable) {
            return true;
          }

          return expiry < now;
        }

        if (status === "active") {
          // Active keys are either not expired or reusable
          if (expiry < now) {
            return false;
          }

          if (!key.used) {
            return true;
          }

          return key.reusable;
        }

        return false;
      });
  }, [keys, selectedUser, status]);

  return (
    <div className="flex flex-col md:w-2/3">
      <p className="text-md mb-8">
        <Link className="font-medium" to="/settings">
          Settings
        </Link>
        <span className="mx-2">/</span> Pre-Auth Keys
      </p>
      {!access ? (
        <Notice title="Pre-auth key permissions restricted" variant="warning">
          You do not have the necessary permissions to generate pre-auth keys. Please contact your
          administrator to request access or to generate a pre-auth key for you.
        </Notice>
      ) : missing.length > 0 ? (
        <Notice title="Missing authentication keys" variant="error">
          An error occurred while fetching the authentication keys for the following users:{" "}
          {missing.map(({ user }, index) => (
            <>
              <Code key={user.id}>{getUserDisplayName(user)}</Code>
              {index < missing.length - 1 ? ", " : ". "}
            </>
          ))}
          Their keys may not be listed correctly. Please check the server logs for more information.
        </Notice>
      ) : undefined}
      <h1 className="mb-2 text-2xl font-medium">Pre-Auth Keys</h1>
      <p className="mb-4">
        Headscale fully supports pre-authentication keys in order to easily add devices to your
        Tailnet. To learn more about using pre-authentication keys, visit the{" "}
        <Link external styled to="https://tailscale.com/kb/1085/auth-keys/">
          Tailscale documentation
        </Link>
      </p>
      <AddAuthKey
        currentSubject={currentSubject}
        selfServiceOnly={selfServiceOnly}
        url={url}
        users={users}
      />
      <div className="mt-4 flex items-center gap-4">
        <Select
          className="w-full"
          defaultSelectedKey="__headplane_all"
          isDisabled={isDisabled}
          label="User"
          onSelectionChange={(value) => setSelectedUser(value?.toString() ?? "")}
          placeholder="Select a user"
        >
          {[
            <Select.Item key="__headplane_all">All</Select.Item>,
            ...keys
              .filter((k): k is { user: User; preAuthKeys: PreAuthKey[] } => k.user !== null)
              .map(({ user }) => (
                <Select.Item key={user.id}>{getUserDisplayName(user)}</Select.Item>
              )),
            ...(keys.some(({ user }) => user === null)
              ? [<Select.Item key="__headplane_tag_only">Tag Only</Select.Item>]
              : []),
          ]}
        </Select>
        <Select
          className="w-full"
          defaultSelectedKey="active"
          isDisabled={isDisabled}
          label="Status"
          onSelectionChange={(value) => setStatus((value?.toString() ?? "active") as Status)}
          placeholder="Select a status"
        >
          <Select.Item key="all">All</Select.Item>
          <Select.Item key="active">Active</Select.Item>
          <Select.Item key="expired">Used/Expired</Select.Item>
          <Select.Item key="reusable">Reusable</Select.Item>
          <Select.Item key="ephemeral">Ephemeral</Select.Item>
        </Select>
      </div>
      <TableList className="mt-4">
        {keys.flatMap(({ preAuthKeys }) => preAuthKeys).length === 0 ? (
          <TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
            <FileKey2 />
            <p className="font-semibold">No pre-auth keys have been created yet.</p>
          </TableList.Item>
        ) : filteredKeys.length === 0 ? (
          <TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
            <FileKey2 />
            <p className="font-semibold">No pre-auth keys match the selected filters.</p>
          </TableList.Item>
        ) : (
          filteredKeys.map((key) => {
            // Tag-only keys have no user
            if (!key.user) {
              return (
                <TableList.Item key={key.id}>
                  <AuthKeyRow authKey={key} user={null} />
                </TableList.Item>
              );
            }

            // TODO: Why is Headscale using email as the user ID here?
            // https://github.com/juanfont/headscale/issues/2520
            const user = users.find((user) => user.id === key.user?.id);
            if (!user) {
              return null;
            }

            return (
              <TableList.Item key={key.id}>
                <AuthKeyRow authKey={key} user={user} />
              </TableList.Item>
            );
          })
        )}
      </TableList>
    </div>
  );
}
