import type { PreAuthKey } from '~/types';
import { defineApiEndpoints } from '../factory';

export interface PreAuthKeyEndpoints {
	/**
	 * Retrieves all pre-authentication keys for a specific user.
	 *
	 * @param user The user to retrieve pre-authentication keys for.
	 * @returns An array of `PreAuthKey` objects representing the pre-authentication keys.
	 */
	getPreAuthKeys(user: string): Promise<PreAuthKey[]>;

	/**
	 * Creates a new pre-authentication key for a specific user.
	 *
	 * @param user The user to create the pre-authentication key for.
	 * @param ephemeral Whether the key is ephemeral.
	 * @param reusable Whether the key is reusable.
	 * @param expiration The expiration date of the key, or `null` for no expiration.
	 * @param aclTags An array of ACL tags to associate with the key, or `null` for none.
	 * @returns A `PreAuthKey` object representing the newly created pre-authentication key.
	 */
	createPreAuthKey(
		user: string,
		ephemeral: boolean,
		reusable: boolean,
		expiration: Date | null,
		aclTags: string[] | null,
	): Promise<PreAuthKey>;

	/**
	 * Expires a specific pre-authentication key for a user.
	 *
	 * @param user The user associated with the pre-authentication key.
	 * @param key The pre-authentication key to expire.
	 */
	expirePreAuthKey(user: string, key: string): Promise<void>;
}

export default defineApiEndpoints<PreAuthKeyEndpoints>((client, apiKey) => ({
	getPreAuthKeys: async (user) => {
		const { preAuthKeys } = await client.apiFetch<{
			preAuthKeys: PreAuthKey[];
		}>('GET', 'v1/preauthkey', apiKey, { user });

		return preAuthKeys;
	},

	createPreAuthKey: async (user, ephemeral, reusable, expiration, aclTags) => {
		const { preAuthKey } = await client.apiFetch<{
			preAuthKey: PreAuthKey;
		}>('POST', 'v1/preauthkey', apiKey, {
			user,
			ephemeral,
			reusable,
			expiration: expiration ? expiration.toISOString() : null,
			aclTags,
		});

		return preAuthKey;
	},

	expirePreAuthKey: async (user, key) => {
		await client.apiFetch<void>('POST', 'v1/preauthkey/expire', apiKey, {
			user,
			key,
		});
	},
}));
