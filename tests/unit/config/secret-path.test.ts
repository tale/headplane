import { describe, expect, test } from 'vitest';
import type { PartialHeadplaneConfigWithPaths } from '~/server/config/config-schema';
import { ConfigError } from '~/server/config/error';
import { loadConfigKeyPaths } from '~/server/config/load';
import { createFakeFile } from '../setup/overlay-fs';

describe('Configuration secret path handling', () => {
	test('should correctly substitute server.cookie_secret', async () => {
		createFakeFile('/secrets/cookie_secret.txt', 'supersecretcookievalue');
		const config = {
			server: {
				cookie_secret_path: '/secrets/cookie_secret.txt',
			},
		} as PartialHeadplaneConfigWithPaths;

		await loadConfigKeyPaths(config);
		expect(config.server?.cookie_secret).toBe('supersecretcookievalue');
	});

	test('should throw error for missing secret file', async () => {
		const config = {
			server: {
				cookie_secret_path: '/secrets/missing_cookie_secret.txt',
			},
		} as PartialHeadplaneConfigWithPaths;

		await expect(loadConfigKeyPaths(config)).rejects.toMatchObject(
			ConfigError.from('MISSING_SECRET_FILE', {
				pathKey: 'server.cookie_secret_path',
				filePath: '/secrets/missing_cookie_secret.txt',
			}),
		);
	});

	test('should throw error for conflicting secret path and field', async () => {
		const config = {
			server: {
				cookie_secret: 'explicitsecretvalue',
				cookie_secret_path: '/secrets/cookie_secret.txt',
			},
		} as PartialHeadplaneConfigWithPaths;

		await expect(loadConfigKeyPaths(config)).rejects.toMatchObject(
			ConfigError.from('CONFLICTING_SECRET_PATH_FIELD', {
				fieldName: 'server.cookie_secret',
			}),
		);
	});

	test('should correctly interpolate env vars in secret paths', async () => {
		process.env.HP_TEST_COOKIE_SECRET_FILE = 'cookie_secret.txt';
		createFakeFile(
			`/secrets/${process.env.HP_TEST_COOKIE_SECRET_FILE}`,
			'envvarsecretvalue',
		);

		const config = {
			server: {
				// biome-ignore lint/suspicious/noTemplateCurlyInString: Test supports interpolation
				cookie_secret_path: '/secrets/${HP_TEST_COOKIE_SECRET_FILE}',
			},
		} as PartialHeadplaneConfigWithPaths;

		await loadConfigKeyPaths(config);
		expect(config.server?.cookie_secret).toBe('envvarsecretvalue');
	});

	test('should throw error for missing interpolated env var in secret path', async () => {
		const config = {
			server: {
				// biome-ignore lint/suspicious/noTemplateCurlyInString: Test supports interpolation
				cookie_secret_path: '/secrets/${MISSING_ENV_VAR}',
			},
		} as PartialHeadplaneConfigWithPaths;

		await expect(loadConfigKeyPaths(config)).rejects.toMatchObject(
			ConfigError.from('MISSING_INTERPOLATION_VARIABLE', {
				pathKey: 'server.cookie_secret_path',
				variableName: 'MISSING_ENV_VAR',
			}),
		);
	});
});
