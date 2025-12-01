import { access, constants, readFile } from 'node:fs/promises';
import { type } from 'arktype';
import { load } from 'js-yaml';
import log from '~/utils/log';
import {
	headplaneConfig,
	PartialHeadplaneConfig,
	partialHeadplaneConfig,
	pathSupportedKeys,
} from './config-schema';
import { ConfigError } from './error';

/**
 * Main entrypoint that attempts to load and merge configuration from both
 * a YAML config file (if available) and environment variables. Importantly,
 * the environment variables will override any values set in the config file.
 *
 * The function also supports loading secret values from file paths for
 * specific configuration keys (e.g., certificates, private keys) by checking
 * for corresponding `_path` suffixed environment variables or config file
 * entries.
 *
 * @param configPathOverride Used for testing to override the config file path
 * @returns @ref{HeadplaneConfig} The fully validated configuration
 * @throws {Error} If there are validation errors in the final configuration
 */
export async function loadConfig(configPathOverride?: string) {
	const configPath =
		configPathOverride != null
			? configPathOverride
			: process.env.HEADPLANE_CONFIG_PATH != null
				? String(process.env.HEADPLANE_CONFIG_PATH)
				: '/etc/headplane/config.yaml';

	const fileConfig = await loadConfigFile(configPath);
	const envConfig = await loadConfigEnv();

	const combinedConfig = deepMerge(fileConfig, envConfig);
	await loadConfigKeyPaths(combinedConfig);

	const finalConfig = headplaneConfig(combinedConfig);
	if (finalConfig instanceof type.errors) {
		throw ConfigError.from('INVALID_REQUIRED_FIELDS', {
			messages: finalConfig.map((e) => e.toString()),
		});
	}

	return finalConfig;
}

/**
 * Attempts to load configuration from a YAML file at the specified path.
 * If the file is not accessible, it returns undefined.
 *
 * @param path The file path to load the configuration from
 * @returns A partial configuration object or undefined
 * @throws {Error} If there are validation errors in the loaded configuration
 */
export async function loadConfigFile(path: string) {
	try {
		await access(path, constants.R_OK);
	} catch {
		log.info('config', 'Could not access config file at path: %s', path);
		return;
	}

	const rawBuffer = await readFile(path, 'utf8');
	const rawConfig = load(rawBuffer);
	const config = partialHeadplaneConfig(rawConfig);
	if (config instanceof type.errors) {
		throw ConfigError.from('INVALID_REQUIRED_FIELDS', {
			messages: config.map((e) => e.toString()),
		});
	}

	return config;
}

/**
 * Loads configuration overrides from environment variables prefixed with
 * `HEADPLANE_`. Nested configuration keys can be represented using double
 * underscores (`__`). For example, `HEADPLANE_SERVER__PORT=8080` would set
 * the `server.port` configuration key to `8080`.
 *
 * @returns A partial configuration object or undefined
 * @throws {Error} If there are validation errors in the loaded configuration
 */
export async function loadConfigEnv() {
	if (process.env.HEADPLANE_LOAD_ENV_OVERRIDES != null) {
		log.warn(
			'config',
			'HEADPLANE_LOAD_ENV_OVERRIDES is deprecated and will be removed in future versions',
		);
		log.warn(
			'config',
			'Environment variables are always loaded and `.env` files are no longer supported',
		);
	}

	const rawConfig: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value == null || !key.startsWith('HEADPLANE_')) {
			continue;
		}

		const parsedValue = parseEnvValue(value);
		const configKey = key.slice('HEADPLANE_'.length).toLowerCase();
		deepSet(rawConfig, configKey.split('__'), parsedValue);
	}

	const config = partialHeadplaneConfig(rawConfig);
	if (config instanceof type.errors) {
		throw ConfigError.from('INVALID_REQUIRED_FIELDS', {
			messages: config.map((e) => e.toString()),
		});
	}

	return Object.keys(config).length > 0 ? config : undefined;
}

/**
 * Deeply merges multiple objects together. Later objects in the arguments
 * list will override properties of earlier objects.
 *
 * @param objects The objects to merge
 * @returns The merged object
 */
function deepMerge<T>(...objects: (T | undefined)[]): T {
	const result: { [key: string]: unknown } = {};
	for (const obj of objects.filter((o) => o != null)) {
		for (const [key, value] of Object.entries(
			obj as {
				[key: string]: unknown;
			},
		)) {
			if (value != null && typeof value === 'object' && !Array.isArray(value)) {
				if (
					result[key] == null ||
					typeof result[key] !== 'object' ||
					Array.isArray(result[key])
				) {
					result[key] = {};
				}
				result[key] = deepMerge(result[key], value);
			} else {
				result[key] = value;
			}
		}
	}

	return result as T;
}

/**
 * Sets a value deeply within an object based on the provided path.
 *
 * @param obj The object to set the value in
 * @param path An array of keys representing the path to set
 * @param value The value to set at the specified path
 */
function deepSet(
	obj: { [key: string]: unknown },
	path: string[],
	value: unknown,
): void {
	let current = obj;
	for (let i = 0; i < path.length - 1; i++) {
		const key = path[i];
		if (current[key] == null || typeof current[key] !== 'object') {
			current[key] = {};
		}

		current = current[key] as { [key: string]: unknown };
	}

	current[path[path.length - 1]] = value;
}

/**
 * Parses an environment variable string value into an appropriate type.
 * Supports booleans, null, undefined, and numbers. Falls back to string.
 *
 * @param value The environment variable string value
 * @returns The parsed value
 */
function parseEnvValue(value: string): unknown {
	const v = value.trim().toLowerCase();
	if (v === 'true') return true;
	if (v === 'false') return false;
	if (v === 'null') return null;
	if (v === 'undefined') return undefined;

	if (/^-?\d+(\.\d+)?$/.test(v)) {
		const num = Number(v);
		if (!Number.isNaN(num)) return num;
	}

	return value;
}

/**
 * For configuration keys that support loading from file paths (e.g.,
 * certificates, private keys), this function checks for corresponding
 * `_path` suffixed keys and loads the file content if the main key is
 * not already set.
 *
 * @param partial The partial configuration object to update
 */
export async function loadConfigKeyPaths(partial: PartialHeadplaneConfig) {
	for (const key of pathSupportedKeys) {
		const pathKey = `${key}_path`;
		const pathValue = deepGet(partial, pathKey.split('.'));
		const existing = deepGet(partial, key.split('.'));

		if (pathValue == null || typeof pathValue !== 'string') {
			continue;
		}

		if (existing != null) {
			throw ConfigError.from('CONFLICTING_SECRET_PATH_FIELD', {
				fieldName: key,
			});
		}

		const realPath = pathValue.replace(/\$\{([^}]+)\}/g, (_, variableName) => {
			const value = process.env[variableName];
			if (value === undefined) {
				throw ConfigError.from('MISSING_INTERPOLATION_VARIABLE', {
					pathKey: `${key}_path`,
					variableName: variableName,
				});
			}

			return value;
		});

		try {
			const fileContent = await readFile(realPath, 'utf8');
			deepSet(partial, key.split('.'), fileContent.trim().normalize());
		} catch {
			throw ConfigError.from('MISSING_SECRET_FILE', {
				pathKey: `${key}_path`,
				filePath: realPath,
			});
		}
	}
}

/**
 * Deeply retrieves a value from an object based on the provided path.
 *
 * @param obj The object to retrieve the value from
 * @param path An array of keys representing the path to retrieve
 * @returns The value at the specified path or undefined if not found
 */
function deepGet(obj: { [key: string]: unknown }, path: string[]): unknown {
	let current = obj;
	for (const segment of path) {
		if (current == null || typeof current !== 'object') {
			return undefined;
		}

		current = current[segment] as { [key: string]: unknown };
	}

	return current;
}
