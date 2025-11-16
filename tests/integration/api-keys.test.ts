import { describe, expect, test } from 'vitest';
import { getRuntimeClient, HS_VERSIONS } from './setup/env';

describe.for(HS_VERSIONS)('Headscale %s: API Keys', (version) => {
	test('api keys can be fetched', async () => {
		const client = await getRuntimeClient(version);
		const apiKeys = await client.getApiKeys();
		expect(Array.isArray(apiKeys)).toBe(true);
		expect(apiKeys.length).toBe(1);
	});
});
