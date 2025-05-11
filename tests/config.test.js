import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create a temp file with given content, return its path
// Note: This helper does not automatically clean up created files/directories.
function writeTempFile(baseName, content) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'headplane-test-'));
	const filePath = path.join(dir, baseName);
	fs.writeFileSync(filePath, content);
	return filePath;
}

// Helper to create a temporary YAML config file with minimal required structure
function writeTempYamlConfig(customConfig = {}) {
	const defaultConfig = {
		debug: false,
		server: {
			host: '127.0.0.1',
			port: 8080,
			cookie_secret: '12345678901234567890123456789012', // Exactly 32 chars
			cookie_secure: false,
			agent: {
				authkey: 'testagentauthkey',
				ttl: 180000,
				cache_path: '/tmp/agent_cache.json',
			},
		},
		headscale: {
			url: 'http://localhost:8081', // Required!
			config_strict: false,
			// api_key or api_key_path might be provided by specific tests or be absent
		},
		// OIDC is optional at the top level, so it's not in defaultConfig by default.
		// Tests requiring OIDC will add the oidc block via customConfig.
	};

	// Deep merge customConfig into defaultConfig
	function deepMerge(target, source) {
		let output = { ...target };
		if (isObject(target) && isObject(source)) {
			output = { ...target, ...source };

			for (const key of Object.keys(source)) {
				if (isObject(source[key]) && key in target && isObject(target[key])) {
					output[key] = deepMerge(target[key], source[key]);
				} else {
					output[key] = source[key];
				}
			}

			const sections = ['oidc', 'server', 'headscale'];
			for (const sectionName of sections) {
				if (output[sectionName] && source[sectionName]) {
					const sectionSource = source[sectionName];
					const sectionDefault = target[sectionName] || {};
					const sectionOutput = output[sectionName];

					for (const baseKey of ['client_secret', 'cookie_secret', 'api_key']) {
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

	function isObject(item) {
		return item && typeof item === 'object' && !Array.isArray(item);
	}

	if (typeof customConfig === 'string') {
		return writeTempFile('config.yaml', customConfig);
	}
	const mergedConfig = deepMerge(defaultConfig, customConfig);
	return writeTempFile('config.yaml', yaml.dump(mergedConfig));
}

// Basic YAML object to string converter for the helper (no longer primary method)
function yamlToString(obj, indent = '') {
	return Object.entries(obj)
		.map(([key, value]) => {
			if (typeof value === 'object' && value !== null) {
				return `${indent}${key}:\n${yamlToString(value, `${indent}  `)}`;
			}
			return `${indent}${key}: ${JSON.stringify(value)}`;
		})
		.join('\n');
}

// Store original process.env to restore after tests that modify it
const originalEnv = { ...process.env };

describe('Configuration Loading', () => {
	let loadConfig;
	let ConfigError;

	beforeAll(async () => {
		const module = await import('../app/server/config/loader.ts');
		loadConfig = module.loadConfig;
		ConfigError = module.ConfigError;
	});

	beforeEach(() => {
		// biome-ignore lint/performance/noDelete: Necessary for test environment cleanup
		delete process.env.HEADPLANE_OIDC__CLIENT_SECRET;
		// biome-ignore lint/performance/noDelete: Necessary for test environment cleanup
		delete process.env.HEADPLANE_OIDC__CLIENT_SECRET_PATH;
		// biome-ignore lint/performance/noDelete: Necessary for test environment cleanup
		delete process.env.HEADPLANE_SERVER__COOKIE_SECRET;
		// biome-ignore lint/performance/noDelete: Necessary for test environment cleanup
		delete process.env.HEADPLANE_SERVER__COOKIE_SECRET_PATH;
		// biome-ignore lint/performance/noDelete: Necessary for test environment cleanup
		delete process.env.HEADPLANE_HEADSCALE__API_KEY;
		// biome-ignore lint/performance/noDelete: Necessary for test environment cleanup
		delete process.env.HEADPLANE_HEADSCALE__API_KEY_PATH;
		// biome-ignore lint/performance/noDelete: Necessary for test environment cleanup
		delete process.env.TEST_SECRET_DIR;

		// Create a dummy agent_cache.json file as the loader tries to read it
		// when server.agent.cache_path is defined and loadEnv might be true.
		const dummyCachePath = '/tmp/agent_cache.json';
		if (!fs.existsSync(dummyCachePath)) {
			// Ensure directory exists if it's deeper, though /tmp should be fine
			const dirname = path.dirname(dummyCachePath);
			if (!fs.existsSync(dirname)) {
				fs.mkdirSync(dirname, { recursive: true });
			}
			fs.writeFileSync(dummyCachePath, JSON.stringify({}));
		}
	});

	afterAll(() => {
		Object.assign(process.env, originalEnv);
	});

	describe('OIDC Configuration', () => {
		const minimalOidcRequiredFields = {
			token_endpoint_auth_method: 'client_secret_basic',
			disable_api_key_login: false,
			headscale_api_key: 'dummyHeadscaleApiKeyForOidcBlock',
			// client_secret or client_secret_path is provided by each test as needed
		};

		it('should load client_secret directly from YAML', async () => {
			const tempConfigPath = writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test-client',
					client_secret: 'yaml-direct-oidc-secret',
					...minimalOidcRequiredFields,
				},
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.oidc.client_secret).toBe('yaml-direct-oidc-secret');
			expect(config.oidc.client_secret_path).toBeUndefined();
		});

		it('should load client_secret from file specified in client_secret_path', async () => {
			const secretValue = 'yaml-file-oidc-secret';
			const secretFilePath = writeTempFile('oidc_secret.txt', secretValue);
			const tempConfigPath = writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test-client',
					client_secret_path: secretFilePath,
					...minimalOidcRequiredFields,
				},
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.oidc.client_secret).toBe(secretValue);
		});

		it('should override YAML client_secret with environment variable', async () => {
			const envSecret = 'env-direct-oidc-secret';
			process.env.HEADPLANE_OIDC__CLIENT_SECRET = envSecret;
			const tempConfigPath = writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test-client',
					client_secret: 'yaml-to-be-overridden', // This will be overridden
					...minimalOidcRequiredFields,
				},
			});
			const config = await loadConfig({ loadEnv: true, path: tempConfigPath });
			expect(config.oidc.client_secret).toBe(envSecret);
		});

		it('should override YAML client_secret_path with environment variable', async () => {
			const secretValue = 'env-file-oidc-secret';
			const secretFilePath = writeTempFile('env_oidc_secret.txt', secretValue);
			process.env.HEADPLANE_OIDC__CLIENT_SECRET_PATH = secretFilePath;
			const tempConfigPath = writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test-client',
					// Provide a placeholder client_secret to satisfy schema if issuer/client_id are present,
					// as client_secret_path from YAML will be ignored due to env var taking precedence.
					client_secret: 'placeholder-secret-for-schema-check',
					...minimalOidcRequiredFields,
				},
			});
			const config = await loadConfig({ loadEnv: true, path: tempConfigPath });
			expect(config.oidc.client_secret).toBe(secretValue);
		});

		it('should handle environment variable interpolation in client_secret_path', async () => {
			const secretValue = 'interpolated-env-file-oidc-secret';
			const secretDir = fs.mkdtempSync(
				path.join(os.tmpdir(), 'headplane-secret-dir-'),
			);
			const secretFilePath = path.join(secretDir, 'interpolated_oidc.txt');
			fs.writeFileSync(secretFilePath, secretValue);
			process.env.TEST_SECRET_DIR = secretDir;
			process.env.HEADPLANE_OIDC__CLIENT_SECRET_PATH =
				'${TEST_SECRET_DIR}/interpolated_oidc.txt';

			const tempConfigPath = writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test-client',
					client_secret: 'placeholder-for-schema-if-path-from-env', // Placeholder for schema validation
					...minimalOidcRequiredFields,
				},
			});
			const config = await loadConfig({ loadEnv: true, path: tempConfigPath });
			expect(config.oidc.client_secret).toBe(secretValue);
		});

		it('should reject when both client_secret and client_secret_path are in YAML', async () => {
			const secretFilePath = writeTempFile('conflict_oidc.txt', 'irrelevant');
			const tempConfigPath = writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test-client',
					client_secret: 'yaml-direct-secret',
					client_secret_path: secretFilePath,
					...minimalOidcRequiredFields,
				},
			});
			let thrownError = null;
			try {
				await loadConfig({ loadEnv: false, path: tempConfigPath });
			} catch (e) {
				thrownError = e;
			}
			expect(thrownError).not.toBeNull();
			if (thrownError) {
				expect(thrownError.name).toBe('ConfigError');
				expect(thrownError.message).toMatch(
					/Only one of "client_secret" or "client_secret_path" may be set/,
				);
			}
		});

		it('should reject when client_secret_path points to non-existent file', async () => {
			const tempConfigPath = writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test-client',
					client_secret_path: '/path/to/non_existent_oidc_secret.txt',
					...minimalOidcRequiredFields,
				},
			});
			await expect(
				loadConfig({ loadEnv: false, path: tempConfigPath }),
			).rejects.toThrow(ConfigError);
			await expect(
				loadConfig({ loadEnv: false, path: tempConfigPath }),
			).rejects.toThrow(/File read error|ENOENT/);
		});

		it('should reject when client_secret_path has unresolvable env var interpolation', async () => {
			process.env.HEADPLANE_OIDC__CLIENT_SECRET_PATH =
				'${MISSING_TEST_SECRET_DIR}/secret.txt';
			const tempConfigPath = writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test-client',
					client_secret: 'placeholder-for-schema-if-path-from-env', // Placeholder for schema validation
					...minimalOidcRequiredFields,
				},
			});
			await expect(
				loadConfig({ loadEnv: true, path: tempConfigPath }),
			).rejects.toThrow(ConfigError);
			await expect(
				loadConfig({ loadEnv: true, path: tempConfigPath }),
			).rejects.toThrow(
				'Environment variable "MISSING_TEST_SECRET_DIR" not found',
			);
		});

		it('should load from client_secret_path when client_secret is null in YAML', async () => {
			const secretValue = 'oidc-secret-from-file-when-null';
			const secretFilePath = writeTempFile(
				'oidc_secret_via_path_null.txt',
				secretValue,
			);
			const tempConfigPath = writeTempYamlConfig({
				oidc: {
					issuer: 'https://example.com/oidc',
					client_id: 'test-client-null-case',
					client_secret: null, // Explicitly null
					client_secret_path: secretFilePath,
					...minimalOidcRequiredFields, // This will provide other required OIDC fields
				},
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.oidc.client_secret).toBe(secretValue);
			// The loader should delete the path key after processing
			expect(config.oidc.client_secret_path).toBeUndefined();
		});
	});

	describe('Server Configuration', () => {
		it('should load cookie_secret directly from YAML', async () => {
			const validCookieSecret = 'abcdefghijklmnopqrstuvwxyz123456'; // 32 chars
			const tempConfigPath = writeTempYamlConfig({
				server: {
					// host and port will come from defaultConfig
					cookie_secret: validCookieSecret,
					// cookie_secure and agent will come from defaultConfig
				},
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.server.cookie_secret).toBe(validCookieSecret);
		});

		it('should load cookie_secret from file', async () => {
			const secretValue = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // Exactly 32 'a's
			const secretFilePath = writeTempFile('cookie_secret.txt', secretValue);
			const tempConfigPath = writeTempYamlConfig({
				server: {
					cookie_secret_path: secretFilePath,
				},
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.server.cookie_secret).toBe(secretValue);
		});

		it('should reject when both cookie_secret and cookie_secret_path are in YAML', async () => {
			const secretFilePath = writeTempFile(
				'conflict_cookie.txt',
				'irrelevant'.padEnd(32, 'X'),
			);
			const tempConfigPath = writeTempYamlConfig({
				server: {
					cookie_secret: '12345678901234567890123456789012',
					cookie_secret_path: secretFilePath,
				},
			});
			let thrownError = null;
			try {
				await loadConfig({ loadEnv: false, path: tempConfigPath });
			} catch (e) {
				thrownError = e;
			}
			expect(thrownError).not.toBeNull();
			if (thrownError) {
				expect(thrownError.name).toBe('ConfigError');
				expect(thrownError.message).toMatch(
					/Only one of "cookie_secret" or "cookie_secret_path" may be set/,
				);
			}
		});

		it('should reject when neither cookie_secret nor cookie_secret_path is provided', async () => {
			const yamlWithoutServerCookieSecret = `
        debug: false
        server:
          host: "127.0.0.1"
          port: 8080
          # cookie_secret and cookie_secret_path are intentionally omitted
          cookie_secure: false
          agent:
            authkey: "testagentauthkey"
            ttl: 180000
            cache_path: "/tmp/agent_cache.json"
        headscale:
          url: "http://localhost:8081"
          config_strict: false
      `;
			const tempConfigPath = writeTempYamlConfig(yamlWithoutServerCookieSecret);

			await expect(
				loadConfig({ loadEnv: false, path: tempConfigPath }),
			).rejects.toThrow(ConfigError);
			await expect(
				loadConfig({ loadEnv: false, path: tempConfigPath }),
			).rejects.toThrow(
				'Either "cookie_secret" or "cookie_secret_path" must be provided for cookie_secret',
			);
		});

		it('should allow server.agent.authkey to be null if no path is provided', async () => {
			const tempConfigPath = writeTempYamlConfig({
				server: {
					agent: {
						authkey: null, // Explicitly null, no authkey_path
						// Other agent fields will come from defaultConfig via deepMerge
					},
				},
				// Other top-level required fields (headscale, debug) will come from defaultConfig
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.server.agent.authkey).toBeNull();
		});

		it('should keep path string for server.agent.cache_path and interpolate env vars', async () => {
			process.env.MY_AGENT_CACHE_SUBDIR = 'test-subdir';
			const cachePathValue =
				'/tmp/my-agent-cache-${MY_AGENT_CACHE_SUBDIR}/cache.json';
			const expectedInterpolatedPath =
				'/tmp/my-agent-cache-test-subdir/cache.json';

			const tempConfigPath = writeTempYamlConfig({
				server: {
					agent: {
						cache_path: cachePathValue,
					},
				},
			});

			// Ensure the path does NOT exist, so if loader tries to read it, it would fail
			// For safety, only attempt to delete if it's in /tmp/
			if (
				expectedInterpolatedPath.startsWith('/tmp/') &&
				fs.existsSync(expectedInterpolatedPath)
			) {
				fs.unlinkSync(expectedInterpolatedPath);
			}
			if (
				expectedInterpolatedPath.startsWith('/tmp/') &&
				fs.existsSync(path.dirname(expectedInterpolatedPath))
			) {
				// fs.rmdirSync(path.dirname(expectedInterpolatedPath), { recursive: true }); // Be careful with rmdir
			}

			const config = await loadConfig({ loadEnv: true, path: tempConfigPath });

			expect(config.server.agent.cache_path).toBe(expectedInterpolatedPath);
		});

		it('should load server.agent.authkey from authkey_path when authkey is null in YAML', async () => {
			const secretValue = 'agent-authkey-from-file';
			const secretFilePath = writeTempFile('agent_authkey.txt', secretValue);
			const tempConfigPath = writeTempYamlConfig({
				server: {
					agent: {
						authkey: null, // Explicitly null
						authkey_path: secretFilePath,
						// ttl and cache_path will come from defaultConfig
					},
				},
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.server.agent.authkey).toBe(secretValue);
			expect(config.server.agent.authkey_path).toBeUndefined();
		});

		it('should reject if both server.agent.authkey and authkey_path are provided', async () => {
			const secretFilePath = writeTempFile(
				'agent_authkey_conflict.txt',
				'some-content',
			);
			const tempConfigPath = writeTempYamlConfig({
				server: {
					agent: {
						authkey: 'direct-agent-authkey',
						authkey_path: secretFilePath,
					},
				},
			});
			let thrownError = null;
			try {
				await loadConfig({ loadEnv: false, path: tempConfigPath });
			} catch (e) {
				thrownError = e;
			}
			expect(thrownError).not.toBeNull();
			if (thrownError) {
				expect(thrownError.name).toBe('ConfigError');
				expect(thrownError.message).toMatch(
					/Only one of agent "authkey" or "authkey_path" may be set/,
				);
			}
		});
	});

	describe('Headscale Configuration', () => {
		it('should load api_key directly from YAML', async () => {
			const tempConfigPath = writeTempYamlConfig({
				headscale: {
					// url and config_strict will come from defaultConfig
					api_key: 'hs-yaml-direct-api-key',
				},
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.headscale.api_key).toBe('hs-yaml-direct-api-key');
		});

		it('should load api_key from file', async () => {
			const secretValue = 'hs-file-api-key';
			const secretFilePath = writeTempFile('hs_api_key.txt', secretValue);
			const tempConfigPath = writeTempYamlConfig({
				headscale: {
					api_key_path: secretFilePath,
				},
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.headscale.api_key).toBe(secretValue);
		});

		it('should allow neither api_key nor api_key_path (optional)', async () => {
			const tempConfigPath = writeTempYamlConfig({
				headscale: {
					// api_key and api_key_path are absent, should be fine
				},
			});
			const config = await loadConfig({ loadEnv: false, path: tempConfigPath });
			expect(config.headscale.api_key).toBeUndefined();
			expect(config.headscale.api_key_path).toBeUndefined();
		});

		it('should reject when both api_key and api_key_path are in YAML', async () => {
			const secretFilePath = writeTempFile('conflict_hs_api.txt', 'irrelevant');
			const tempConfigPath = writeTempYamlConfig({
				headscale: {
					api_key: 'hs-direct-key',
					api_key_path: secretFilePath,
				},
			});
			let thrownError = null;
			try {
				await loadConfig({ loadEnv: false, path: tempConfigPath });
			} catch (e) {
				thrownError = e;
			}
			expect(thrownError).not.toBeNull();
			if (thrownError) {
				expect(thrownError.name).toBe('ConfigError');
				expect(thrownError.message).toMatch(
					/Only one of "api_key" or "api_key_path" may be set/,
				);
			}
		});

		it('should keep path string for headscale.config_path and interpolate env vars', async () => {
			process.env.MY_HS_CONFIG_SUBDIR = 'hs-test-subdir';
			const configPathValue =
				'/etc/headscale-${MY_HS_CONFIG_SUBDIR}/config.yaml';
			const expectedInterpolatedPath =
				'/etc/headscale-hs-test-subdir/config.yaml';

			const tempConfigPath = writeTempYamlConfig({
				headscale: {
					config_path: configPathValue,
				},
			});

			const config = await loadConfig({ loadEnv: true, path: tempConfigPath });

			expect(config.headscale.config_path).toBe(expectedInterpolatedPath);
		});
	});
});
