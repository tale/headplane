import { dump } from 'js-yaml';
import { beforeAll, describe, expect, test } from 'vitest';
import { ConfigError } from '~/server/config/error';
import { loadConfig, loadConfigFile } from '~/server/config/load';
import { clearFakeFiles, createFakeFile } from '../setup/overlay-fs';

const writeYaml = (filePath: string, content: unknown) => {
	const yamlContent = dump(content);
	createFakeFile(filePath, yamlContent);
};

describe('Configuration YAML file loading', () => {
	beforeAll(() => {
		clearFakeFiles();
	});

	test('should correctly parse different types from YAML file', async () => {
		const filePath = '/config/test-config.yaml';
		writeYaml(filePath, {
			headscale: {
				url: 'http://localhost:8080',
			},
			oidc: {
				client_id: 'my-client-id',
			},
			server: {
				port: 8000,
			},
			integration: {
				agent: {
					enabled: true,
				},
			},
		});

		const config = await loadConfigFile(filePath);
		expect(config?.headscale?.url).toBe('http://localhost:8080');
		expect(config?.oidc?.client_id).toBe('my-client-id');
		expect(config?.server?.port).toBe(8000);
		expect(config?.integration?.agent?.enabled).toBe(true);
	});

	test('should not throw errors for inaccessible file', async () => {
		await expect(
			loadConfigFile('/non-existent-path/config.yaml'),
		).resolves.toBeUndefined();
	});

	test('should correctly get a finalized config from YAML', async () => {
		const filePath = '/config/minimal-config.yaml';
		writeYaml(filePath, {
			headscale: {
				url: 'http://localhost:8080',
			},
			server: {
				cookie_secret: 'thirtytwo-character-cookiesecret',
			},
		});

		const config = await loadConfig(filePath);
		expect(config.headscale.url).toBe('http://localhost:8080');
		expect(config.server.cookie_secret).toBe(
			'thirtytwo-character-cookiesecret',
		);
	});

	test('should throw error for missing required fields', async () => {
		const filePath = '/config/invalid-config.yaml';
		writeYaml(filePath, {
			server: {
				port: 8000,
			},
		});

		await expect(loadConfig(filePath)).rejects.toEqual(
			expect.objectContaining(
				ConfigError.from('INVALID_REQUIRED_FIELDS', { messages: [] }),
			),
		);
	});
});
