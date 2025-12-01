import { beforeEach, describe, expect, test } from 'vitest';
import { ConfigError } from '~/server/config/error';
import { loadConfig, loadConfigEnv } from '~/server/config/load';

const envVarSnapshot = { ...process.env };
describe('Configuration environment variable handling', () => {
	beforeEach(() => {
		process.env = { ...envVarSnapshot };
	});

	test('should correctly parse different types from env vars', async () => {
		process.env.HEADPLANE_HEADSCALE__URL = 'http://localhost:8080';
		process.env.HEADPLANE_OIDC__CLIENT_ID = 'my-client-id';
		process.env.HEADPLANE_SERVER__PORT = '8000';
		process.env.HEADPLANE_INTEGRATION__AGENT__ENABLED = 'true';

		const config = await loadConfigEnv();
		expect(config?.headscale?.url).toBe('http://localhost:8080');
		expect(config?.oidc?.client_id).toBe('my-client-id');
		expect(config?.server?.port).toBe(8000);
		expect(config?.integration?.agent?.enabled).toBe(true);
	});

	test('should not load env vars without the HEADPLANE_ prefix', async () => {
		process.env.HEADPLANE_HEADSCALE__URL = 'http://localhost:8080';
		process.env.OTHER_PREFIX_OIDC__CLIENT_ID = 'should-not-be-loaded';

		const config = await loadConfigEnv();
		expect(config?.headscale?.url).toBe('http://localhost:8080');
		expect(config?.oidc?.client_id).toBeUndefined();
	});

	test('should correctly get a finalized config from env vars', async () => {
		process.env.HEADPLANE_HEADSCALE__URL = 'http://localhost:8080';
		process.env.HEADPLANE_SERVER__COOKIE_SECRET =
			'thirtytwo-character-cookiesecret';

		const config = await loadConfig('./non-existent-path.yaml');
		expect(config.headscale.url).toBe('http://localhost:8080');
		expect(config.server.cookie_secret).toBe(
			'thirtytwo-character-cookiesecret',
		);
	});

	test('should throw error for missing required fields', async () => {
		process.env.HEADPLANE_SERVER__PORT = '8000';

		await expect(loadConfig('./non-existent-path.yaml')).rejects.toEqual(
			expect.objectContaining(
				ConfigError.from('INVALID_REQUIRED_FIELDS', { messages: [] }),
			),
		);
	});
});
