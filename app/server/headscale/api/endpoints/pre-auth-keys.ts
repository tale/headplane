import type { PreAuthKey } from "~/types";

import { defineApiEndpoints } from "../factory";

export interface PreAuthKeyEndpoints {
  /**
   * Retrieves all pre-authentication keys for a specific user.
   */
  getPreAuthKeys(user: string): Promise<PreAuthKey[]>;

  /**
   * Creates a new pre-authentication key.
   * Either user or aclTags must be provided (Headscale 0.28+).
   */
  createPreAuthKey(
    user: string | null,
    ephemeral: boolean,
    reusable: boolean,
    expiration: Date | null,
    aclTags: string[] | null,
  ): Promise<PreAuthKey>;

  /**
   * Expires a specific pre-authentication key for a user.
   */
  expirePreAuthKey(user: string, key: string): Promise<void>;
}

export default defineApiEndpoints<PreAuthKeyEndpoints>((client, apiKey) => ({
  getPreAuthKeys: async (user) => {
    const { preAuthKeys } = await client.apiFetch<{
      preAuthKeys: PreAuthKey[];
    }>("GET", "v1/preauthkey", apiKey, { user });

    return preAuthKeys;
  },

  createPreAuthKey: async (user, ephemeral, reusable, expiration, aclTags) => {
    const body: Record<string, unknown> = {
      ephemeral,
      reusable,
      expiration: expiration ? expiration.toISOString() : null,
    };

    if (user) {
      body.user = user;
    }

    if (aclTags && aclTags.length > 0) {
      body.aclTags = aclTags;
    }

    const { preAuthKey } = await client.apiFetch<{
      preAuthKey: PreAuthKey;
    }>("POST", "v1/preauthkey", apiKey, body);

    return preAuthKey;
  },

  expirePreAuthKey: async (user, key) => {
    await client.apiFetch<void>("POST", "v1/preauthkey/expire", apiKey, {
      user,
      key,
    });
  },
}));
