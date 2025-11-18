import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { ConfigError, loadConfig } from '~/server/config/loader';
import { HeadplaneConfig } from '~/server/config/schema';
import { clearFakeFiles, createFakeFile } from './setup/overlay-fs';

async function writeTempFile(baseName: string, content: string) {
	const dir = await mkdtemp(join(tmpdir(), 'headplane-test-'));

	const path = join(dir, baseName);
	await writeFile(path, content);
	return path;
}

type RecursivePartial<T> = {
	[P in keyof T]?: T[P] extends object ? RecursivePartial<T[P]> : T[P];
};

function writeTempYamlConfig(
	customConfig: RecursivePartial<HeadplaneConfig> | string = {},
) {
	const defaultConfig = {
		debug: false,
		server: {
			host: '127.0.0.1',
			port: 8080,
			data_path: '/var/lib/headplane',
			cookie_secret: '12345678901234567890123456789012',
			cookie_secure: false,
			cookie_max_age: 86400,
		},
		headscale: { url: 'http://localhost:8081', config_strict: false },
	} satisfies HeadplaneConfig;

	// biome-ignore lint/suspicious/noExplicitAny: I don't care
	function deepMerge(target: any, source: any): any {
		let output = { ...target };
		if (isObject(target) && isObject(source)) {
			output = { ...target, ...source };
			for (const key of Object.keys(source)) {
				const sourceValue = source[key as keyof typeof source];
				const targetValue = target[key as keyof typeof target];
				if (isObject(sourceValue) && key in target && isObject(targetValue)) {
					output[key] = deepMerge(targetValue, sourceValue);
				} else {
					output[key] = source[key];
				}
			}
			for (const sectionName of ['oidc', 'server', 'headscale']) {
				if (output[sectionName] && source[sectionName]) {
					const sectionSource = source[sectionName];
					const sectionDefault = target[sectionName] || {};
					const sectionOutput = output[sectionName];

					for (const baseKey of ['cookie_secret', 'client_secret', 'api_key']) {
						const valueKey = baseKey;
						const pathKey = `${baseKey}_path`;
						const sourceHasValue = Object.hasOwn(sectionSource, valueKey);
						const sourceHasPath = Object.hasOwn(sectionSource, pathKey);
						const defaultHasValue = Object.hasOwn(sectionDefault, valueKey);
						const defaultHasPath = Object.hasOwn(sectionDefault, pathKey);

						if (sourceHasPath && !sourceHasValue && defaultHasValue) {
							delete sectionOutput[valueKey];
						} else if (sourceHasValue && !sourceHasPath && defaultHasPath) {
							delete sectionOutput[pathKey];
						}
					}
				}
			}
		}
		return output;
	}

	// biome-ignore lint/suspicious/noExplicitAny: I don't care
	function isObject(item: any): item is Record<string, unknown> {
		return item && typeof item === 'object' && !Array.isArray(item);
	}

	const merged = deepMerge(defaultConfig, customConfig);
	const yamlContent =
		typeof customConfig === 'string' ? customConfig : stringify(merged);
	return writeTempFile('config.yaml', yamlContent);
}

// Store original process.env to restore after tests
const originalEnv = { ...process.env };

describe('Configuration Loading', () => {
	beforeEach(() => {
		delete process.env.HEADPLANE_OIDC__CLIENT_SECRET_PATH;
		delete process.env.HEADPLANE_SERVER__COOKIE_SECRET_PATH;
		delete process.env.HEADPLANE_HEADSCALE__API_KEY_PATH;
		delete process.env.TEST_SECRET_DIR;

		clearFakeFiles();
		createFakeFile('/var/lib/headplane/agent_cache.json', JSON.stringify({}));
		createFakeFile(
			'/var/lib/headplane/users.json',
			`[{"u":"acb3294f89a16b554e06b80d5266a3c8b09a883e1fa78ac459a550bf52a32564","c":65535}]`,
		);
		createFakeFile('/tmp/agent_cache.json', JSON.stringify({}));
		createFakeFile('irrelevant', 'irrelevant-content');
		createFakeFile('placeholder', 'placeholder-content');
	});

	afterAll(() => {
		Object.assign(process.env, originalEnv);
		clearFakeFiles();
	});

	describe('OIDC Configuration', () => {
		const minimalOidcFields = {
			token_endpoint_auth_method: 'client_secret_basic' as const,
			disable_api_key_login: false,
			headscale_api_key: 'dummyKey',
			user_storage_file: '/var/lib/headplane/users.json',
			profile_picture_source: 'oidc' as const,
			strict_validation: true,
			scope: 'openid email profile',
		};

		it('should load client_secret from file specified in client_secret_path', async () => {
			const secretValue = 'yaml-file-oidc-secret';
			const secretPath = await writeTempFile('oidc_secret.txt', secretValue);
			const tempConfigPath = await writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test',
					client_secret_path: secretPath,
					...minimalOidcFields,
				},
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.oidc?.client_secret).toBe(secretValue);
		});

		it('should override YAML client_secret_path with environment variable', async () => {
			const envValue = 'env-file-oidc-secret';
			const envPath = await writeTempFile('env_oidc_secret.txt', envValue);
			process.env.HEADPLANE_OIDC__CLIENT_SECRET_PATH = envPath;
			// Instead of 'irrelevant', use a temp file that exists
			const irrelevantPath = await writeTempFile(
				'irrelevant.txt',
				'irrelevant-content',
			);
			const tempConfigPath = await writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test',
					client_secret_path: irrelevantPath,
					...minimalOidcFields,
				},
			});
			const config = await loadConfig({ loadEnv: true, path: tempConfigPath });
			expect(config.oidc?.client_secret).toBe(envValue);
		});

		it('should handle environment variable interpolation in client_secret_path', async () => {
			const value = 'interpolated-secret';
			const dir = await mkdtemp(join(tmpdir(), 'headplane-secret-dir-'));
			const filePath = join(dir, 'secret.txt');
			await writeFile(filePath, value);

			process.env.TEST_SECRET_DIR = dir;
			process.env.HEADPLANE_OIDC__CLIENT_SECRET_PATH =
				// biome-ignore lint/suspicious/noTemplateCurlyInString: Test supports interpolation
				'${TEST_SECRET_DIR}/secret.txt';
			// Instead of 'placeholder', use a temp file that exists
			const placeholderPath = await writeTempFile(
				'placeholder.txt',
				'placeholder-content',
			);
			const tempConfigPath = await writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test',
					client_secret_path: placeholderPath,
					...minimalOidcFields,
				},
			});
			const config = await loadConfig({ loadEnv: true, path: tempConfigPath });
			expect(config.oidc?.client_secret).toBe(value);
		});

		it('should reject when client_secret_path points to non-existent file', async () => {
			const tempConfigPath = await writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test',
					client_secret_path: '/no/such/file',
					...minimalOidcFields,
				},
			});
			await expect(
				loadConfig({ loadEnv: false, path: tempConfigPath }),
			).rejects.toThrow(ConfigError);
		});

		it('should reject when client_secret_path has unresolvable env var interpolation', async () => {
			process.env.HEADPLANE_OIDC__CLIENT_SECRET_PATH =
				// biome-ignore lint/suspicious/noTemplateCurlyInString: Test supports interpolation
				'${MISSING_DIR}/secret.txt';
			const tempConfigPath = await writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test',
					client_secret_path: 'placeholder',
					...minimalOidcFields,
				},
			});
			await expect(
				loadConfig({ loadEnv: true, path: tempConfigPath }),
			).rejects.toThrow(/Environment variable "MISSING_DIR" not found/);
		});
	});

	describe('Server Configuration', () => {
		it('should load cookie_secret directly from YAML', async () => {
			const valid = 'abcdefghijklmnopqrstuvwxyz123456';
			const tempConfigPath = await writeTempYamlConfig({
				server: { cookie_secret: valid },
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.server.cookie_secret).toBe(valid);
		});

		it('should load cookie_secret from file', async () => {
			const secret = 'a'.repeat(32);
			const secretPath = await writeTempFile('cookie_secret.txt', secret);
			const tempConfigPath = await writeTempYamlConfig({
				server: { cookie_secret_path: secretPath },
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.server.cookie_secret).toBe(secret);
		});

		it('should reject when both cookie_secret and cookie_secret_path are in YAML', async () => {
			const secretPath = await writeTempFile('conflict.txt', 'x'.repeat(32));
			const tempConfigPath = await writeTempYamlConfig({
				server: {
					cookie_secret: '1'.repeat(32),
					cookie_secret_path: secretPath,
				},
			});
			await expect(
				loadConfig({ loadEnv: false, path: tempConfigPath }),
			).rejects.toThrow(
				/Only one of "cookie_secret" or "cookie_secret_path" may be set/,
			);
		});

		it('should reject when neither cookie_secret nor cookie_secret_path is provided', async () => {
			const yaml = `
debug: false
server:
  host: "127.0.0.1"
  port: 8080
  cookie_secure: false
  agent:
    authkey: "key"
    ttl: 180000
    cache_path: "/tmp/cache.json"
headscale:
  url: "http://localhost"
  config_strict: false
`;
			const tempConfigPath = await writeTempYamlConfig(yaml);
			await expect(
				loadConfig({ loadEnv: false, path: tempConfigPath }),
			).rejects.toThrow(
				/Either "cookie_secret" or "cookie_secret_path" must be provided for cookie_secret/,
			);
		});
	});

	describe('Headscale Configuration', () => {
		it('should load headscale_api_key directly from YAML', async () => {
			const tempConfigPath = await writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test',
					headscale_api_key: 'hs-yaml-key',
					token_endpoint_auth_method: 'client_secret_basic',
					disable_api_key_login: false,
					user_storage_file: '/var/lib/headplane/users.json',
					profile_picture_source: 'oidc',
					strict_validation: true,
					scope: 'openid email profile',
				},
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.oidc?.headscale_api_key).toBe('hs-yaml-key');
		});

		it('should load headscale_api_key from file', async () => {
			const val = 'hs-file-key';
			const p = await writeTempFile('hs_api_key.txt', val);
			const tempConfigPath = await writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test',
					headscale_api_key_path: p,
					token_endpoint_auth_method: 'client_secret_basic',
					disable_api_key_login: false,
					user_storage_file: '/var/lib/headplane/users.json',
					profile_picture_source: 'oidc',
					strict_validation: true,
					scope: 'openid email profile',
				},
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.oidc?.headscale_api_key).toBe(val);
		});

		it('should reject when both headscale_api_key and headscale_api_key_path are in YAML', async () => {
			const p = await writeTempFile('conflict.txt', 'irrelevant');
			const tempConfigPath = await writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test',
					headscale_api_key: 'key',
					headscale_api_key_path: p,
					token_endpoint_auth_method: 'client_secret_basic',
					disable_api_key_login: false,
					user_storage_file: '/var/lib/headplane/users.json',
					profile_picture_source: 'oidc',
					strict_validation: true,
					scope: 'openid email profile',
				},
			});
			await expect(
				loadConfig({ loadEnv: false, path: tempConfigPath }),
			).rejects.toThrow(
				/Only one of "headscale_api_key" or "headscale_api_key_path" may be set/,
			);
		});

		it('should keep config_path string and interpolate env vars', async () => {
			process.env.MY_HS_CONFIG_SUBDIR = 'hs-test';
			// biome-ignore lint/suspicious/noTemplateCurlyInString: Test supports interpolation
			const cfgVal = '/etc/headscale-${MY_HS_CONFIG_SUBDIR}/config.yaml';
			const exp = '/etc/headscale-hs-test/config.yaml';
			const tempConfigPath = await writeTempYamlConfig({
				headscale: { config_path: cfgVal },
			});
			const config = await loadConfig({ loadEnv: true, path: tempConfigPath });
			expect(config.headscale.config_path).toBe(exp);
		});
	});
});
