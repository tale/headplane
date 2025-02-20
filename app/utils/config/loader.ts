import { constants, access, readFile, writeFile } from 'node:fs/promises';
import { Document, parseDocument } from 'yaml';
import log from '~/utils/log';
import mutex from '~/utils/mutex';
import type { HeadplaneConfig } from '~server/context/parser';
import { HeadscaleConfig, validateConfig } from './parser';

let runtimeYaml: Document | undefined = undefined;
let runtimeConfig: HeadscaleConfig | undefined = undefined;
let runtimePath: string | undefined = undefined;
let runtimeMode: 'rw' | 'ro' | 'no' = 'no';
const runtimeLock = mutex();

export type ConfigModes =
	| {
			mode: 'rw' | 'ro';
			config: HeadscaleConfig;
	  }
	| {
			mode: 'no';
			config: undefined;
	  };

export function hs_getConfig(): ConfigModes {
	if (runtimeMode === 'no') {
		return {
			mode: 'no',
			config: undefined,
		};
	}

	runtimeLock.acquire();
	// We can assert if mode is not 'no'
	const config = runtimeConfig!;
	runtimeLock.release();

	return {
		mode: runtimeMode,
		config: config,
	};
}

export async function hs_loadConfig(path?: string, strict?: boolean) {
	if (runtimeConfig !== undefined) {
		return;
	}

	runtimeLock.acquire();
	if (!path) {
		runtimeLock.release();
		return;
	}

	runtimeMode = await validateConfigPath(path);
	if (runtimeMode === 'no') {
		runtimeLock.release();
		return;
	}

	runtimePath = path;
	const rawConfig = await loadConfigFile(path);
	if (!rawConfig) {
		return;
	}

	const config = validateConfig(rawConfig, strict ?? true);
	if (!config) {
		runtimeMode = 'no';
	}

	runtimeConfig = config;
}

async function validateConfigPath(path: string) {
	log.debug('CFGX', `Validating Headscale configuration file at ${path}`);
	try {
		await access(path, constants.F_OK | constants.R_OK);
		log.info('CFGX', `Headscale configuration found at ${path}`);
	} catch (e) {
		log.error('CFGX', `Headscale configuration not readable at ${path}`);
		log.error('CFGX', `${e}`);
		return 'no';
	}

	let writeable = false;
	try {
		await access(path, constants.W_OK);
		writeable = true;
	} catch (e) {
		log.warn('CFGX', `Headscale configuration not writeable at ${path}`);
		log.debug('CFGX', `${e}`);
	}

	return writeable ? 'rw' : 'ro';
}

async function loadConfigFile(path: string) {
	log.debug('CFGX', `Loading Headscale configuration file at ${path}`);
	try {
		const data = await readFile(path, 'utf8');
		const configYaml = parseDocument(data);

		if (configYaml.errors.length > 0) {
			log.error(
				'CFGX',
				`Error parsing Headscale configuration file at ${path}`,
			);
			for (const error of configYaml.errors) {
				log.error('CFGX', `  ${error.toString()}`);
			}

			return;
		}

		runtimeYaml = configYaml;
		return configYaml.toJSON() as unknown;
	} catch (e) {
		log.error('CFGX', `Error reading Headscale configuration file at ${path}`);
		log.error('CFGX', `${e}`);
		return;
	}
}

type PatchConfig = { path: string; value: unknown };
export async function hs_patchConfig(patches: PatchConfig[]) {
	if (!runtimeConfig || !runtimeYaml || !runtimePath) {
		log.error('CFGX', 'Headscale configuration not loaded');
		return;
	}

	if (runtimeMode === 'no') {
		return;
	}

	if (runtimeMode === 'ro') {
		throw new Error('Headscale configuration is read-only');
	}

	runtimeLock.acquire();
	const config = runtimeConfig!;

	log.debug('CFGX', 'Patching Headscale configuration');
	for (const patch of patches) {
		const { path, value } = patch;
		log.debug('CFGX', 'Patching %s in Headscale configuration', path);
		// If the key is something like `test.bar."foo.bar"`, then we treat
		// the foo.bar as a single key, and not as two keys, so that needs
		// to be split correctly.

		// Iterate through each character, and if we find a dot, we check if
		// the next character is a quote, and if it is, we skip until the next
		// quote, and then we skip the next character, which should be a dot.
		// If it's not a quote, we split it.
		const key = [];
		let current = '';
		let quote = false;

		for (const char of path) {
			if (char === '"') {
				quote = !quote;
			}

			if (char === '.' && !quote) {
				key.push(current);
				current = '';
				continue;
			}

			current += char;
		}

		key.push(current.replaceAll('"', ''));

		// Deletion handling
		if (value === null) {
			runtimeYaml.deleteIn(key);
			continue;
		}

		runtimeYaml.setIn(key, value);
	}

	// Revalidate the configuration
	const newRawConfig = runtimeYaml.toJSON() as unknown;
	runtimeConfig = runtimeStrict
		? validateConfig(newRawConfig, runtimeStrict)
		: (newRawConfig as HeadscaleConfig);

	log.debug(
		'CFGX',
		'Writing patched Headscale configuration to %s',
		runtimePath,
	);
	await writeFile(runtimePath, runtimeYaml.toString(), 'utf8');
	runtimeLock.release();
}

// IMPORTANT THIS IS A SIDE EFFECT ON INIT
hs_loadConfig(__hs_context.config_path, __hs_context.config_strict);
