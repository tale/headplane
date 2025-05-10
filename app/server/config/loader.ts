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

// Helper function for environment variable interpolation in file paths
function interpolateEnvVars(filePath: string): string {
	const interpolatedPath = filePath.replace(
		/\$\{(.*?)\}/g,
		(match, varName) => {
			const value = env[varName];
			if (value === undefined) {
				throw new Error(
					`Environment variable "${varName}" not found for path interpolation in "${filePath}"`,
				);
			}
			return value;
		},
	);
	if (interpolatedPath !== filePath) {
		log.debug(
			'config',
			'Interpolated path "%s" to "%s"',
			filePath,
			interpolatedPath,
		);
	}
	return interpolatedPath;
}

// loadConfig is a has a lifetime of the entire application and is
// used to load the configuration for Headplane. It is called once.
//
// TODO: Potential for file watching on the configuration
// But this may not be necessary as a use-case anyways
export async function loadConfig({ loadEnv, path }: EnvOverrides) {
	log.debug('config', 'Loading configuration file: %s', path);
	const validPath = await validateConfigPath(path);
	if (!validPath) {
		exit(1);
	}

	const data = await loadConfigFile(path);
	if (!data) {
		exit(1);
	}

	let configObject = validateConfig({ ...data, debug: log.debugEnabled });
	if (!configObject) {
		exit(1);
	}

	if (!loadEnv) {
		log.debug('config', 'Environment variable overrides are disabled');
		log.debug('config', 'This also disables the loading of a .env file');
		return configObject;
	}

	log.info('config', 'Loading a .env file (if available)');
	configDotenv({ override: true });
	configObject = coalesceEnv(configObject);
	if (!configObject) {
		exit(1);
	}

	// Load secret values from files if file paths are specified
	const loadSecretsSuccess = await loadSecretsFromFiles(configObject);
	if (!loadSecretsSuccess) {
		log.error(
			'config',
			'Halting due to error(s) in loading secrets from file paths.',
		);
		exit(1);
	}

	return configObject;
}

export async function hp_loadConfig() {
	// This will be implemented in the future
}

async function validateConfigPath(path: string) {
	try {
		await access(path, constants.F_OK | constants.R_OK);
		log.info('config', 'Found a valid configuration file at %s', path);
		return true;
	} catch (error: unknown) {
		log.error('config', 'Unable to read a configuration file at %s', path);
		log.error(
			'config',
			'%s',
			error instanceof Error ? error.message : String(error),
		);
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
	} catch (e: unknown) {
		log.error('config', 'Error reading configuration file at %s', path);
		log.error('config', '%s', e instanceof Error ? e.message : String(e));
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

		return; // ArkType validation failed, result is Type.Errors
	}

	// Mutual exclusivity and mandatory checks for value/path pairs are now handled by
	// the valueOrPath helper directly within the ArkType schema definitions.
	// No further manual checks needed here for those.

	return result; // ArkType validation passed, result is HeadplaneConfig
}

function coalesceEnv(config: HeadplaneConfig) {
	const envConfig: Record<string, unknown> = {};
	const rootKeys: string[] = Object.values(envVariables);

	const vars = Object.entries(env).filter(([key, value]) => {
		if (!value) {
			return false;
		}

		if (!key.startsWith('HEADPLANE_')) {
			return false;
		}

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
			const pathPart = configPath.shift() as string;
			if (!(pathPart in current)) {
				current[pathPart] = {};
			}

			current = current[pathPart] as Record<string, unknown>;
		}

		current[configPath[0]] = value;
	}

	const toMerge = coalesceConfig(envConfig);
	if (!toMerge) {
		return; // Return undefined if coalescing env vars resulted in an invalid partial config
	}

	// Assert toMerge as DeepPartial<HeadplaneConfig> if TypeScript has trouble inferring compatibility
	return deepMerge(config, toMerge as DeepPartial<HeadplaneConfig>);
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

// Recursively processes an object to find keys ending in `_path`,
// interpolates environment variables in their string values,
// reads the file content, and assigns it to the corresponding key without `_path`.
async function loadSecretsFromFiles(
	currentConfigLevel: Record<string, unknown>,
	currentPathPrefix = '',
): Promise<boolean> {
	for (const key in currentConfigLevel) {
		// Ensure it's a direct property and not from prototype chain
		if (Object.prototype.hasOwnProperty.call(currentConfigLevel, key)) {
			const value = currentConfigLevel[key];
			const fullKeyPathForLog = currentPathPrefix
				? `${currentPathPrefix}.${key}`
				: key;

			if (key.endsWith('_path') && typeof value === 'string') {
				const valueKey = key.substring(0, key.length - '_path'.length);
				let processedPath: string;

				try {
					processedPath = interpolateEnvVars(value);
				} catch (e: unknown) {
					log.error(
						'config',
						'Error during environment variable interpolation for config key "%s" (path: "%s"): %s',
						fullKeyPathForLog,
						value,
						e instanceof Error ? e.message : String(e),
					);
					return false; // Indicate failure
				}

				log.debug(
					'config',
					'Loading value for "%s" from file (via %s): %s',
					valueKey,
					fullKeyPathForLog,
					processedPath,
				);
				try {
					const secretContent = await readFile(processedPath, 'utf8');
					// Ensure the target key exists or can be set; TypeScript might not know about it if currentConfigLevel is 'any'
					// However, the schema validation should ensure `valueKey` is a valid peer to `valueKey_path`.
					currentConfigLevel[valueKey] = secretContent.trim();
				} catch (err: unknown) {
					log.error(
						'config',
						'Failed to read file "%s" for config key "%s" (defined in %s): %s',
						processedPath,
						valueKey,
						fullKeyPathForLog,
						err instanceof Error ? err.message : String(err),
					);
					return false; // Indicate failure
				}
			} else if (
				typeof value === 'object' &&
				value !== null &&
				!Array.isArray(value)
			) {
				// Recursively process nested objects
				if (
					!(await loadSecretsFromFiles(
						value as Record<string, unknown>,
						fullKeyPathForLog,
					))
				) {
					return false; // Propagate failure from deeper levels
				}
			}
		}
	}
	return true; // Indicate success for this level
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
