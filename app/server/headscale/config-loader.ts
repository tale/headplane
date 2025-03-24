import { constants, access, readFile, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { type } from 'arktype';
import { Document, parseDocument } from 'yaml';
import log from '~/utils/log';
import { headscaleConfig } from './config-schema';

interface PatchConfig {
	path: string;
	value: unknown;
}

// We need a class for the config because we need to be able to
// support retrieving it via a getter but also be able to
// patch it and to query it for its mode
class HeadscaleConfig {
	private config?: typeof headscaleConfig.infer;
	private document?: Document;
	private access: 'rw' | 'ro' | 'no';
	private path?: string;
	private writeLock = false;

	constructor(
		access: 'rw' | 'ro' | 'no',
		config?: typeof headscaleConfig.infer,
		document?: Document,
		path?: string,
	) {
		this.access = access;
		this.config = config;
		this.document = document;
		this.path = path;
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

	async patch(patches: PatchConfig[]) {
		if (!this.path || !this.document || !this.readable() || !this.writable()) {
			return;
		}

		log.debug('config', 'Patching Headscale configuration');
		for (const patch of patches) {
			const { path, value } = patch;
			log.debug('config', 'Patching %s with %o', path, value);

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
			if (value === null) {
				this.document.deleteIn(key);
				continue;
			}

			this.document.setIn(key, value);
		}

		// Revalidate our configuration and update the config
		// object with the new configuration
		log.info('config', 'Revalidating Headscale configuration');
		const config = validateConfig(this.document.toJSON());
		if (!config) {
			return;
		}

		log.debug(
			'config',
			'Writing updated Headscale configuration to %s',
			this.path,
		);

		// We need to lock the writeLock so that we don't try to write
		// to the file while we're already writing to it
		while (this.writeLock) {
			await setTimeout(100);
		}

		this.writeLock = true;
		await writeFile(this.path, this.document.toString(), 'utf8');
		this.config = config;
		this.writeLock = false;
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

	const document = await loadConfigFile(path);
	if (!document) {
		return new HeadscaleConfig('no');
	}

	if (!strict) {
		return new HeadscaleConfig(
			w ? 'rw' : 'ro',
			augmentUnstrictConfig(document.toJSON()),
			document,
			path,
		);
	}

	const config = validateConfig(document.toJSON());
	if (!config) {
		return new HeadscaleConfig('no');
	}

	return new HeadscaleConfig(w ? 'rw' : 'ro', config, document, path);
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

async function loadConfigFile(path: string) {
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

		return configYaml;
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
