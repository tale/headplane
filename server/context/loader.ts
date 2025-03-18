import { constants, access, readFile } from 'node:fs/promises';
import { env } from 'node:process';
import { type } from 'arktype';
import dotenv from 'dotenv';
import { Agent } from 'undici';
import { parseDocument } from 'yaml';
import { testOidc } from '~/utils/oidc';
import log, { hp_loadLogger } from '~server/utils/log';
import mutex from '~server/utils/mutex';
import { hp_setConfig, hp_setSingleton } from './global';
import { HeadplaneConfig, coalesceConfig, validateConfig } from './parser';

const envBool = type('string | undefined').pipe((v) => {
	return ['1', 'true', 'yes', 'on'].includes(v?.toLowerCase() ?? '');
});

const rootEnvs = type({
	HEADPLANE_DEBUG_LOG: envBool,
	HEADPLANE_LOAD_ENV_OVERRIDES: envBool,
	HEADPLANE_CONFIG_PATH: 'string | undefined',
}).onDeepUndeclaredKey('reject');

const HEADPLANE_DEFAULT_CONFIG_PATH = '/etc/headplane/config.yaml';
const runtimeLock = mutex();

// hp_loadConfig should ONLY be called when we explicitly need to reload
// the configuration. This should be done when the configuration file
// changes and we ignore environment variable changes.
//
// TODO: File watching for hp_loadConfig()
export async function hp_loadConfig() {
	runtimeLock.acquire();
	let path = HEADPLANE_DEFAULT_CONFIG_PATH;

	const envs = rootEnvs({
		HEADPLANE_DEBUG_LOG: env.HEADPLANE_DEBUG_LOG,
		HEADPLANE_CONFIG_PATH: env.HEADPLANE_CONFIG_PATH,
		HEADPLANE_LOAD_ENV_OVERRIDES: env.HEADPLANE_LOAD_ENV_OVERRIDES,
	});

	if (envs instanceof type.errors) {
		log.error('CFGX', 'Error parsing environment variables:');
		for (const [number, error] of envs.entries()) {
			log.error('CFGX', ` (${number}): ${error.toString()}`);
		}

		return;
	}

	// Load our debug based logger before ANYTHING
	await hp_loadLogger(envs.HEADPLANE_DEBUG_LOG);
	if (envs.HEADPLANE_CONFIG_PATH) {
		path = envs.HEADPLANE_CONFIG_PATH;
	}

	await validateConfigPath(path);
	const rawConfig = await loadConfigFile(path);
	if (!rawConfig) {
		log.error('CFGX', 'Failed to load Headplane configuration file');
		process.exit(1);
	}

	let config = validateConfig({
		...rawConfig,
		debug: envs.HEADPLANE_DEBUG_LOG,
	});

	if (config && envs.HEADPLANE_LOAD_ENV_OVERRIDES) {
		log.info('CFGX', 'Loading a .env file if one exists');
		dotenv.config();

		log.info(
			'CFGX',
			'Loading environment variables to override the configuration',
		);
		config = coalesceEnv(config);
	}

	if (!config) {
		runtimeLock.release();
		log.error('CFGX', 'Fatal error encountered with configuration');
		process.exit(1);
	}

	// OIDC Related Checks
	if (config.oidc) {
		if (!config.oidc.client_secret && !config.oidc.client_secret_path) {
			log.error('CFGX', 'OIDC configuration is missing a secret, disabling');
			log.error(
				'CFGX',
				'Please specify either `oidc.client_secret` or `oidc.client_secret_path`',
			);
		}

		if (config.oidc?.strict_validation) {
			const result = await testOidc(config.oidc);
			if (!result) {
				log.error('CFGX', 'OIDC configuration failed validation, disabling');
			}
		}
	}

	if (config.headscale.tls_cert_path) {
		log.debug('CFGX', 'Attempting to load supplied Headscale TLS cert');
		try {
			const data = await readFile(config.headscale.tls_cert_path, 'utf8');
			log.info('CFGX', 'Headscale TLS cert loaded successfully');
			hp_setSingleton(
				'api_agent',
				new Agent({
					connect: {
						ca: data.trim(),
					},
				}),
			);
		} catch (error) {
			log.error('CFGX', 'Failed to load Headscale TLS cert');
			log.debug('CFGX', 'Error Details: %o', error);
		}
	} else {
		hp_setSingleton('api_agent', new Agent());
	}

	hp_setConfig(config);
	runtimeLock.release();
}

async function validateConfigPath(path: string) {
	log.debug('CFGX', `Validating Headplane configuration file at ${path}`);
	try {
		await access(path, constants.F_OK | constants.R_OK);
		log.info('CFGX', `Headplane configuration found at ${path}`);
		return true;
	} catch (e) {
		log.error('CFGX', `Headplane configuration not readable at ${path}`);
		log.error('CFGX', `${e}`);
		return false;
	}
}

async function loadConfigFile(path: string) {
	log.debug('CFGX', `Loading Headplane configuration file at ${path}`);
	try {
		const data = await readFile(path, 'utf8');
		const configYaml = parseDocument(data);
		if (configYaml.errors.length > 0) {
			log.error(
				'CFGX',
				`Error parsing Headplane configuration file at ${path}`,
			);
			for (const error of configYaml.errors) {
				log.error('CFGX', `  ${error.toString()}`);
			}

			return;
		}

		if (configYaml.warnings.length > 0) {
			log.warn(
				'CFGX',
				`Warnings parsing Headplane configuration file at ${path}`,
			);
			for (const warning of configYaml.warnings) {
				log.warn('CFGX', `  ${warning.toString()}`);
			}
		}

		return configYaml.toJSON() as unknown;
	} catch (e) {
		log.error('CFGX', `Error reading Headplane configuration file at ${path}`);
		log.error('CFGX', `${e}`);
		return;
	}
}

function coalesceEnv(config: HeadplaneConfig) {
	const envConfig: Record<string, unknown> = {};
	const rootKeys: string[] = rootEnvs.props.map((prop) => prop.key);

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

	log.debug('CFGX', `Coalescing ${vars.length} environment variables`);
	for (const [key, value] of vars) {
		const configPath = key.replace('HEADPLANE_', '').toLowerCase().split('__');
		log.debug('CFGX', `  ${key}=${new Array(value.length).fill('*').join('')}`);

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
