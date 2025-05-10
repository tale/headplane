import { constants, access, readFile } from 'node:fs/promises';
import { env } from 'node:process';
import { type } from 'arktype';
import { configDotenv } from 'dotenv';
import { parseDocument } from 'yaml';
import log from '~/utils/log';
import { EnvOverrides, envVariables } from './env';
import {
	HeadplaneConfig,
	PartialHeadplaneConfig,
	headplaneConfig,
	partialHeadplaneConfig,
} from './schema';

// Custom Error for configuration issues
export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigError';
	}
}

// Helper function for environment variable interpolation in file paths
function interpolateEnvVars(filePath: string): string {
	const interpolatedPath = filePath.replace(
		/\$\{(.*?)\}/g,
		(match, varName) => {
			const value = env[varName];
			if (value === undefined) {
				throw new ConfigError(
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

	await validateConfigPath(path);

	const rawData = await loadConfigFile(path);
	if (typeof rawData !== 'object' || rawData === null) {
		throw new ConfigError('Loaded configuration data is not a valid object.');
	}

	// 1. Initial validation
	const initialValidatedConfig = validateConfig({
		...(rawData as Record<string, unknown>),
		debug: log.debugEnabled,
	});

	// Deep clone before mutation by loadSecretsFromFiles
	let configObject = JSON.parse(JSON.stringify(initialValidatedConfig));

	// Process *_path fields from the YAML file itself, regardless of env loading
	await loadSecretsFromFiles(configObject);

	if (!loadEnv) {
		log.debug('config', 'Environment variable overrides are disabled');
		log.debug('config', 'This also disables the loading of a .env file');
		return validateConfig(configObject); // Re-validate after potential modifications by loadSecretsFromFiles
	}

	log.info('config', 'Loading a .env file (if available)');
	configDotenv({ override: true });

	configObject = coalesceEnv(configObject);

	await loadSecretsFromFiles(configObject);

	return validateConfig(configObject);
}

export async function hp_loadConfig() {
	// This will be implemented in the future
}

async function validateConfigPath(path: string): Promise<void> {
	try {
		await access(path, constants.F_OK | constants.R_OK);
		log.info('config', 'Found a valid configuration file at %s', path);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		log.error('config', 'Unable to read a configuration file at %s', path);
		log.error('config', '%s', message);
		throw new ConfigError(`Config file access error for "${path}": ${message}`);
	}
}

async function loadConfigFile(path: string): Promise<unknown> {
	log.debug('config', 'Reading configuration file at %s', path);
	try {
		const data = await readFile(path, 'utf8');
		const configYaml = parseDocument(data);
		if (configYaml.errors.length > 0) {
			log.error('config', 'Cannot parse configuration file at %s', path);
			let errorMessages = '';
			for (const error of configYaml.errors) {
				log.error('config', ` - ${error.toString()}`);
				errorMessages += `${error.toString()}\n`;
			}
			throw new ConfigError(
				`YAML parsing error in "${path}":\n${errorMessages}`,
			);
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
		const message = e instanceof Error ? e.message : String(e);
		log.error('config', 'Error reading configuration file at %s', path);
		log.error('config', '%s', message);
		if (e instanceof ConfigError) throw e;
		throw new ConfigError(`File read error for "${path}": ${message}`);
	}
}

export function validateConfig(config: unknown): HeadplaneConfig {
	log.debug('config', 'Validating Headplane configuration');
	const result = headplaneConfig(config);

	if (result instanceof type.errors) {
		log.error('config', 'Error validating Headplane configuration:');
		let errorSummary = '';
		for (const [number, error] of result.entries()) {
			log.error('config', ` - (${number}): ${error.toString()}`);
			errorSummary += `(${number}): ${error.toString()}\n`;
		}
		throw new ConfigError(`Configuration validation failed:\n${errorSummary}`);
	}
	return result as HeadplaneConfig;
}

function coalesceEnv(config: HeadplaneConfig): HeadplaneConfig {
	const envConfig: Record<string, unknown> = {};
	const rootKeys: string[] = Object.values(envVariables);

	const vars = Object.entries(env).filter(([key, value]) => {
		if (!value) return false;
		if (!key.startsWith('HEADPLANE_')) return false;
		if (rootKeys.includes(key)) return false;
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
			if (!(pathPart in current)) current[pathPart] = {};
			current = current[pathPart] as Record<string, unknown>;
		}
		current[configPath[0]] = value;
	}

	// coalesceConfig will throw ConfigError if validation of env vars fails.
	// If it succeeds, toMerge will be a valid PartialHeadplaneConfig.
	const toMerge = coalesceConfig(envConfig);

	// If coalesceConfig did not throw, proceed to merge.
	return deepMerge(config, toMerge as DeepPartial<HeadplaneConfig>);
}

export function coalesceConfig(config: unknown): PartialHeadplaneConfig {
	log.debug('config', 'Revalidating config after coalescing variables');
	const out = partialHeadplaneConfig(config);

	if (out instanceof type.errors) {
		log.error(
			'config',
			'Error parsing environment variables into partial config:',
		);
		let errorSummary = '';
		for (const [number, error] of out.entries()) {
			log.error('config', ` - (${number}): ${error.toString()}`);
			errorSummary += `(${number}): ${error.toString()}\n`;
		}
		throw new ConfigError(
			`Environment variable validation failed:\n${errorSummary}`,
		);
	}
	return out as PartialHeadplaneConfig;
}

// Recursively processes an object to find keys ending in `_path`,
// interpolates environment variables in their string values,
// reads the file content, and assigns it to the corresponding key without `_path`.
async function loadSecretsFromFiles(
	currentConfigLevel: Record<string, unknown>,
	currentPathPrefix = '',
): Promise<void> {
	for (const key in currentConfigLevel) {
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
					if (e instanceof ConfigError) throw e;
					const message = e instanceof Error ? e.message : String(e);
					log.error(
						'config',
						'Interpolation error for %s: %s',
						fullKeyPathForLog,
						message,
					);
					throw new ConfigError(
						`Interpolation error for ${fullKeyPathForLog}: ${message}`,
					);
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
					currentConfigLevel[valueKey] = secretContent.trim();
					delete currentConfigLevel[key];
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : String(err);
					log.error(
						'config',
						'Failed to read file "%s" for %s: %s',
						processedPath,
						fullKeyPathForLog,
						message,
					);
					throw new ConfigError(
						`File read error for ${fullKeyPathForLog} (path: ${processedPath}): ${message}`,
					);
				}
			} else if (
				typeof value === 'object' &&
				value !== null &&
				!Array.isArray(value)
			) {
				await loadSecretsFromFiles(
					value as Record<string, unknown>,
					fullKeyPathForLog,
				);
			}
		}
	}
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
