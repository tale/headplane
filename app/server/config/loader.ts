import { constants, access, readFile } from 'node:fs/promises';
import { env } from 'node:process';
import { type } from 'arktype';
import { configDotenv } from 'dotenv';
import { parseDocument } from 'yaml';
import log from '~/utils/log';
import { EnvOverrides, envVariables } from './env';
import {
	HeadplaneConfig,
	headplaneConfig,
	partialHeadplaneConfig,
} from './schema';

// Custom error for config issues
export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigError';
	}
}

/**
 * Interpolate environment variables in a string
 * Replaces ${VAR_NAME} patterns with the actual environment variable values
 */
function interpolateEnvVars(str: string): string {
	return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
		const value = env[varName];
		if (value === undefined) {
			throw new ConfigError(`Environment variable "${varName}" not found`);
		}
		return value;
	});
}

// loadConfig is a has a lifetime of the entire application and is
// used to load the configuration for Headplane. It is called once.
//
// TODO: Potential for file watching on the configuration
// But this may not be necessary as a use-case anyways
export async function loadConfig({ loadEnv, path }: EnvOverrides) {
	log.debug('config', 'Loading configuration file: %s', path);
	await validateConfigPath(path);

	const data = await loadConfigFile(path);
	if (!data) {
		throw new ConfigError('Failed to load configuration file');
	}

	let config = validateConfig({ ...data, debug: log.debugEnabled });

	if (!loadEnv) {
		log.debug('config', 'Environment variable overrides are disabled');
		log.debug('config', 'This also disables the loading of a .env file');
		config = await loadSecretsFromFiles(config);
		log.debug('config', 'Loaded file-based secrets');
		return config;
	}

	log.info('config', 'Loading a .env file (if available)');
	configDotenv({ override: true });
	const merged = coalesceEnv(config);
	if (merged) config = merged;
	if (config.headscale && typeof config.headscale.config_path === 'string') {
		config.headscale.config_path = interpolateEnvVars(
			config.headscale.config_path,
		);
	}

	config = await loadSecretsFromFiles(config);
	log.debug('config', 'Loaded file-based secrets');

	return config;
}

/**
 * Recursively walks the config object; for any key in the whitelist of secret path keys,
 * reads that file and assigns its contents to the corresponding key
 * without the suffix, then removes the "_path" property.
 */
const SECRET_PATH_KEYS = new Set([
	'pre_authkey_path',
	'client_secret_path',
	'headscale_api_key_path',
	'cookie_secret_path',
]);
async function loadSecretsFromFiles<T extends object>(obj: T): Promise<T> {
	// Work with a Record so we can mutate/delete properties
	const record = obj as Record<string, unknown>;

	for (const key of Object.keys(record)) {
		const val = record[key];

		if (val && typeof val === 'object') {
			// recurse into nested objects
			record[key] = await loadSecretsFromFiles(val);
			continue;
		}

		if (SECRET_PATH_KEYS.has(key) && typeof val === 'string') {
			try {
				const path = interpolateEnvVars(val);
				const content = await readFile(path, 'utf8');
				const secretKey = key.slice(0, -5); // drop '_path'
				record[secretKey] = content.trim();
				delete record[key];
				log.debug('config', 'Loaded secret from %s → %s', val, secretKey);
			} catch (err) {
				if (err instanceof ConfigError) throw err;
				log.error('config', 'Failed to read secret file %s: %s', val, err);
				throw new ConfigError(`Failed to read secret file ${val}: ${err}`);
			}
		}
	}

	// Cast back to the original T so callers keep their precise type
	return record as T;
}

export async function hp_loadConfig() {
	// 	// OIDC Related Checks
	// 	if (config.oidc) {
	// 		if (!config.oidc.client_secret && !config.oidc.client_secret_path) {
	// 			log.error('CFGX', 'OIDC configuration is missing a secret, disabling');
	// 			log.error(
	// 				'CFGX',
	// 				'Please specify either `oidc.client_secret` or `oidc.client_secret_path`',
	// 			);
	// 		}
	// 		if (config.oidc?.strict_validation) {
	// 			const result = await testOidc(config.oidc);
	// 			if (!result) {
	// 				log.error('CFGX', 'OIDC configuration failed validation, disabling');
	// 			}
	// 		}
	// 	}
}

async function validateConfigPath(path: string) {
	try {
		await access(path, constants.F_OK | constants.R_OK);
		log.info('config', 'Found a valid configuration file at %s', path);
		return true;
	} catch (error) {
		log.error('config', 'Unable to read a configuration file at %s', path);
		log.error('config', '%s', error);
		throw new ConfigError(
			`Unable to read configuration file at ${path}: ${error}`,
		);
	}
}

async function loadConfigFile(path: string): Promise<unknown> {
	log.debug('config', 'Reading configuration file at %s', path);
	try {
		const data = await readFile(path, 'utf8');
		const configYaml = parseDocument(data);
		if (configYaml.errors.length > 0) {
			log.error('config', 'Cannot parse configuration file at %s', path);
			for (const error of configYaml.errors) {
				log.error('config', ` - ${error.toString()}`);
			}

			throw new ConfigError(`Cannot parse configuration file at ${path}`);
		}

		if (configYaml.warnings.length > 0) {
			log.warn(
				'config',
				'Warnings while parsing configuration file at %s',
				path,
			);
			for (const warning of configYaml.warnings) {
				log.warn('config', ` - ${warning.toString()}`);
			}
		}

		return configYaml.toJSON() as unknown;
	} catch (e) {
		log.error('config', 'Error reading configuration file at %s', path);
		log.error('config', '%s', e);
		throw new ConfigError(`Error reading configuration file at ${path}: ${e}`);
	}
}

export function validateConfig(config: unknown) {
	log.debug('config', 'Validating Headplane configuration');
	const result = headplaneConfig(config);
	if (result instanceof type.errors) {
		const errorMessages = [];
		for (const [number, error] of result.entries()) {
			const errorMsg = error.toString();
			log.error('config', ` - (${number}): ${errorMsg}`);
			errorMessages.push(errorMsg);
		}
		throw new ConfigError(errorMessages.join('\n'));
	}
	return result;
}

function coalesceEnv(config: HeadplaneConfig) {
	const envConfig: Record<string, unknown> = {};
	const rootKeys: string[] = Object.values(envVariables);

	// Typescript is still insanely stupid at nullish filtering
	const vars = Object.entries(env).filter(([key, value]) => {
		if (!value) {
			return false;
		}

		if (!key.startsWith('HEADPLANE_')) {
			return false;
		}

		// Filter out the rootEnv configurations
		if (rootKeys.includes(key)) {
			return false;
		}

		return true;
	}) as [string, string][];

	log.debug('config', 'Coalescing %s environment variables', vars.length);
	for (const [key, value] of vars) {
		const configPath = key.replace('HEADPLANE_', '').toLowerCase().split('__');
		log.debug(
			'config',
			` - ${key}=${new Array(value.length).fill('*').join('')}`,
		);

		let current = envConfig;
		while (configPath.length > 1) {
			const path = configPath.shift() as string;
			if (!(path in current)) {
				current[path] = {};
			}

			current = current[path] as Record<string, unknown>;
		}

		current[configPath[0]] = value;
	}

	const toMerge = coalesceConfig(envConfig);
	if (!toMerge) {
		return;
	}

	// Deep merge the environment variables into the configuration
	// This will overwrite any existing values in the configuration
	return deepMerge(config, toMerge);
}

export function coalesceConfig(config: unknown) {
	log.debug('config', 'Revalidating config after coalescing variables');
	const out = partialHeadplaneConfig(config);
	if (out instanceof type.errors) {
		log.error('config', 'Error parsing variables:');
		for (const [number, error] of out.entries()) {
			log.error('config', ` - (${number}): ${error.toString()}`);
		}

		return;
	}

	return out;
}

type DeepPartial<T> =
	| {
			[P in keyof T]?: DeepPartial<T[P]>;
	  }
	| undefined;

function deepMerge<T>(target: T, source: DeepPartial<T>): T {
	if (typeof target !== 'object' || typeof source !== 'object')
		return source as T;
	const result = { ...target } as T;

	for (const key in source) {
		const val = source[key];
		if (val === undefined || val === null) {
			continue;
		}

		if (typeof val === 'object') {
			result[key] = deepMerge(result[key], val);
			continue;
		}

		result[key] = val;
	}

	return result;
}
