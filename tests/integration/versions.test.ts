import { describe, expect, test } from 'vitest';
import canonicals from '~/openapi-canonical-families.json';
import {
	getBootstrapClient,
	getRuntimeClient,
	HS_VERSIONS,
	Version,
} from './setup/env';

function getCanonicalVersion(version: Version) {
	const canonical = Object.entries(canonicals).find(([_, family]) =>
		family.includes(version),
	)?.[0] as Version | undefined;

	if (!canonical) {
		return version;
	}

	return canonical;
}

describe.for(HS_VERSIONS)('Headscale %s: Runtime Client', (version) => {
	test('the runtime client is usable', async () => {
		const bootstrapper = await getBootstrapClient(version);
		const runtimeClient = bootstrapper.getRuntimeClient('test-api-key');
		expect(runtimeClient).toBeDefined();
	});

	test('the runtime client has the correct canonical API version', async () => {
		const bootstrapper = await getBootstrapClient(version);
		expect(bootstrapper.apiVersion).toBe(getCanonicalVersion(version));
	});

	test('the health check endpoint works', async () => {
		const client = await getRuntimeClient(version);
		const health = await client.isHealthy();
		expect(health).toBe(true);
	});
});
