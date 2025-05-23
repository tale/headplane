import { constants, access, readFile } from 'node:fs/promises';
import { env, exit } from 'node:process';
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

// loadConfig is a has a lifetime of the entire application and is
// used to load the configuration for Headplane. It is called once.
//
// TODO: Potential for file watching on the configuration
// But this may not be necessary as a use-case anyways
export async function loadConfig({ loadEnv, path }: EnvOverrides) {
	log.debug('config', 'Loading configuration file: %s', path);
	const valid = await validateConfigPath(path);
	if (!valid) {
		exit(1);
	}

	const data = await loadConfigFile(path);
	if (!data) {
		exit(1);
	}

	let config = validateConfig({ ...data, debug: log.debugEnabled });
	if (!config) {
		exit(1);
	}

	if (!loadEnv) {
		log.debug('config', 'Environment variable overrides are disabled');
		log.debug('config', 'This also disables the loading of a .env file');
		return config;
	}

	log.info('config', 'Loading a .env file (if available)');
	configDotenv({ override: true });
	config = coalesceEnv(config);
	if (!config) {
		exit(1);
	}

	return config;
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
		return false;
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

			return false;
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
		return false;
	}
}

export function validateConfig(config: unknown) {
	log.debug('config', 'Validating Headplane configuration');
	const result = headplaneConfig(config);
	if (result instanceof type.errors) {
		log.error('config', 'Error validating Headplane configuration:');
		for (const [number, error] of result.entries()) {
			log.error('config', ` - (${number}): ${error.toString()}`);
		}

		return;
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
		if (val === undefined) {
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
