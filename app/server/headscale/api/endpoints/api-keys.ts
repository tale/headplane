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
		if (client.isAtleast('0.27.0')) {
			console.log('wow we are at least 0.27.0!');
		}

		const { apiKeys } = await client.apiFetch<{ apiKeys: Key[] }>(
			'GET',
			'v1/apikey',
			apiKey,
		);

		return apiKeys;
	},
}));
