import type { PreAuthKey } from "~/types";

import type { Capabilities } from "../capabilities";
import type { Transport } from "../transport";

export interface CreatePreAuthKeyOptions {
  /** Owning user ID, or `null` for tag-only keys (0.28+). */
  user: string | null;
  ephemeral: boolean;
  reusable: boolean;
  expiration: Date | null;
  aclTags: string[] | null;
}

export interface PreAuthKeyApi {
  /**
   * List every pre-auth key on the server. Only present when
   * `capabilities.preAuthKeysHaveStableIds` is true (Headscale 0.28+).
   * Pre-0.28 callers must use {@link listForUser}.
   */
  listAll?: () => Promise<PreAuthKey[]>;

  listForUser(userId: string): Promise<PreAuthKey[]>;

  create(opts: CreatePreAuthKeyOptions): Promise<PreAuthKey>;

  expire(key: PreAuthKey): Promise<void>;
}

export function makePreAuthKeyApi(
  transport: Transport,
  capabilities: Capabilities,
  apiKey: string,
): PreAuthKeyApi {
  const api: PreAuthKeyApi = {
    listForUser: async (userId) => {
      const { preAuthKeys } = await transport.request<{
        preAuthKeys: PreAuthKey[];
      }>({ method: "GET", path: "v1/preauthkey", apiKey, query: { user: userId } });
      return preAuthKeys;
    },

    create: async ({ user, ephemeral, reusable, expiration, aclTags }) => {
      const body: Record<string, unknown> = {
        ephemeral,
        reusable,
        expiration: expiration ? expiration.toISOString() : null,
      };
      if (user) body.user = user;
      if (aclTags && aclTags.length > 0) body.aclTags = aclTags;

      const { preAuthKey } = await transport.request<{
        preAuthKey: PreAuthKey;
      }>({ method: "POST", path: "v1/preauthkey", apiKey, body });
      return preAuthKey;
    },

    expire: async (key) => {
      if (capabilities.preAuthKeysHaveStableIds) {
        await transport.request({
          method: "POST",
          path: "v1/preauthkey/expire",
          apiKey,
          body: { id: key.id },
        });
        return;
      }
      // Pre-0.28: expire takes user + key string.
      await transport.request({
        method: "POST",
        path: "v1/preauthkey/expire",
        apiKey,
        body: { user: key.user?.name ?? "", key: key.key },
      });
    },
  };

  if (capabilities.preAuthKeysHaveStableIds) {
    api.listAll = async () => {
      const { preAuthKeys } = await transport.request<{
        preAuthKeys: PreAuthKey[];
      }>({ method: "GET", path: "v1/preauthkey", apiKey });
      return preAuthKeys;
    };
  }

  return api;
}
