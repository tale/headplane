import type { Key } from '~/types';
import { defineApiEndpoints } from '../factory';

export interface ApiKeyEndpoints {
	/**
	 * Retrieves all API keys from the Headscale instance.
	 *
	 * @returns An array of `Key` objects representing the API keys.
	 */
	getApiKeys(): Promise<Key[]>;
}

export default defineApiEndpoints<ApiKeyEndpoints>((client, apiKey) => ({
	getApiKeys: async () => {
		const { apiKeys } = await client.apiFetch<{ apiKeys: Key[] }>(
			'GET',
			'v1/apikey',
			apiKey,
		);

		return apiKeys;
	},
}));
