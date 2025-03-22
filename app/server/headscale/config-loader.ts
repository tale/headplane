import { constants, access, readFile } from 'node:fs/promises';
import { type } from 'arktype';
import { parseDocument } from 'yaml';
import log from '~/utils/log';
import { headscaleConfig } from './config-schema';

interface ConfigModeAvailable {
	access: 'rw' | 'ro';
	// TODO: More attributes
}

interface ConfigModeUnavailable {
	access: 'no';
}

interface PatchConfig {
	path: string;
	value: unknown;
}

// We need a class for the config because we need to be able to
// support retrieving it via a getter but also be able to
// patch it and to query it for its mode
class HeadscaleConfig {
	private config?: typeof headscaleConfig.infer;
	private access: 'rw' | 'ro' | 'no';

	constructor(
		access: 'rw' | 'ro' | 'no',
		config?: typeof headscaleConfig.infer,
	) {
		this.access = access;
	}

	readable() {
		return this.access !== 'no';
	}

	writable() {
		return this.access === 'rw';
	}

	get c() {
		return this.config;
	}

	// TODO: Implement patching
	async patch(patches: PatchConfig[]) {
		return;
	}
}

export async function loadHeadscaleConfig(path?: string, strict = true) {
	if (!path) {
		log.debug('config', 'No Headscale configuration file was provided');
		return new HeadscaleConfig('no');
	}

	log.debug('config', 'Loading Headscale configuration file: %s', path);
	const { r, w } = await validateConfigPath(path);
	if (!r) {
		return new HeadscaleConfig('no');
	}

	const data = await loadConfigFile(path);
	if (!data) {
		return new HeadscaleConfig('no');
	}

	if (!strict) {
		return new HeadscaleConfig(w ? 'rw' : 'ro', augmentUnstrictConfig(data));
	}

	const config = validateConfig(data);
	if (!config) {
		return new HeadscaleConfig('no');
	}

	return new HeadscaleConfig(w ? 'rw' : 'ro', config);
}

async function validateConfigPath(path: string) {
	try {
		await access(path, constants.F_OK | constants.R_OK);
		log.info(
			'config',
			'Found a valid Headscale configuration file at %s',
			path,
		);
	} catch (error) {
		log.error(
			'config',
			'Unable to read a Headscale configuration file at %s',
			path,
		);
		log.error('config', '%s', error);
		return { w: false, r: false };
	}

	try {
		await access(path, constants.F_OK | constants.W_OK);
		return { w: true, r: true };
	} catch (error) {
		log.warn(
			'config',
			'Headscale configuration file at %s is not writable',
			path,
		);
		return { w: false, r: true };
	}
}

async function loadConfigFile(path: string): Promise<unknown> {
	log.debug('config', 'Reading Headscale configuration file at %s', path);
	try {
		const data = await readFile(path, 'utf8');
		const configYaml = parseDocument(data);
		if (configYaml.errors.length > 0) {
			log.error(
				'config',
				'Cannot parse Headscale configuration file at %s',
				path,
			);
			for (const error of configYaml.errors) {
				log.error('config', ` - ${error.toString()}`);
			}

			return false;
		}

		return configYaml.toJSON() as unknown;
	} catch (e) {
		log.error(
			'config',
			'Error reading Headscale configuration file at %s',
			path,
		);
		log.error('config', '%s', e);
		return false;
	}
}

export function validateConfig(config: unknown) {
	log.debug('config', 'Validating Headscale configuration');
	const result = headscaleConfig(config);
	if (result instanceof type.errors) {
		log.error('config', 'Error validating Headscale configuration:');
		for (const [number, error] of result.entries()) {
			log.error('config', ` - (${number}): ${error.toString()}`);
		}

		return;
	}

	return result;
}

// If config_strict is false, we set the defaults and disable
// the schema checking for the values that are not present
function augmentUnstrictConfig(loaded: Partial<typeof headscaleConfig.infer>) {
	log.debug('config', 'Augmenting Headscale configuration in non-strict mode');
	const config = {
		...loaded,
		tls_letsencrypt_cache_dir:
			loaded.tls_letsencrypt_cache_dir ?? '/var/www/cache',
		tls_letsencrypt_challenge_type:
			loaded.tls_letsencrypt_challenge_type ?? 'HTTP-01',
		grpc_listen_addr: loaded.grpc_listen_addr ?? ':50443',
		grpc_allow_insecure: loaded.grpc_allow_insecure ?? false,
		randomize_client_port: loaded.randomize_client_port ?? false,
		unix_socket: loaded.unix_socket ?? '/var/run/headscale/headscale.sock',
		unix_socket_permission: loaded.unix_socket_permission ?? '0770',

		log: loaded.log ?? {
			level: 'info',
			format: 'text',
		},

		logtail: loaded.logtail ?? {
			enabled: false,
		},

		prefixes: loaded.prefixes ?? {
			allocation: 'sequential',
			v4: '',
			v6: '',
		},

		dns: loaded.dns ?? {
			nameservers: {
				global: [],
				split: {},
			},
			search_domains: [],
			extra_records: [],
			magic_dns: false,
			base_domain: 'headscale.net',
		},
	};

	log.warn('config', 'Headscale configuration was loaded in non-strict mode');
	log.warn('config', 'This is very dangerous and comes with a few caveats:');
	log.warn('config', '  - Headplane could very easily crash');
	log.warn('config', '  - Headplane could break your Headscale installation');
	log.warn(
		'config',
		'  - The UI could throw random errors/show incorrect data',
	);

	return config as typeof headscaleConfig.infer;
}
