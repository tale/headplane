// Handle the configuration loading for headscale.
// Functionally only used for reading and writing the configuration file.
// Availability checks and other configuration checks are done in the headplane
// configuration file that's adjacent to this one.
//
// Around the codebase, this is referred to as the config
// Refer to this file on juanfont/headscale for the default values:
// https://github.com/juanfont/headscale/blob/main/hscontrol/types/config.go
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { type Document, parseDocument } from 'yaml'
import { z } from 'zod'

const HeadscaleConfig = z.object({
	tls_letsencrypt_cache_dir: z.string().default('/var/www/cache'),
	tls_letsencrypt_challenge_type: z.enum(['HTTP-01', 'TLS-ALPN-01']).default('HTTP-01'),

	tls_letsencrypt_hostname: z.string().optional(),
	tls_letsencrypt_listen: z.string().optional(),

	tls_cert_path: z.string().optional(),
	tls_key_path: z.string().optional(),

	server_url: z.string().regex(/^https?:\/\//),
	listen_addr: z.string(),
	metrics_listen_addr: z.string().optional(),
	grpc_listen_addr: z.string().default(':50443'),
	grpc_allow_insecure: z.boolean().default(false),

	disable_check_updates: z.boolean().default(false),
	ephemeral_node_inactivity_timeout: z.string().default('120s'),
	randomize_client_port: z.boolean().default(false),
	acl_policy_path: z.string().optional(),

	acme_email: z.string().optional(),
	acme_url: z.string().optional(),

	unix_socket: z.string().default('/var/run/headscale/headscale.sock'),
	unix_socket_permission: z.string().default('0o770'),

	tuning: z.object({
		batch_change_delay: z.string().default('800ms'),
		node_mapsession_buffered_chan_size: z.number().default(30),
	}).optional(),

	noise: z.object({
		private_key_path: z.string(),
	}),

	log: z.object({
		level: z.string().default('info'),
		format: z.enum(['text', 'json']).default('text'),
	}).default({ level: 'info', format: 'text' }),

	logtail: z.object({
		enabled: z.boolean().default(false),
	}).default({ enabled: false }),

	cli: z.object({
		address: z.string().optional(),
		api_key: z.string().optional(),
		timeout: z.string().default('10s'),
		insecure: z.boolean().default(false),
	}).optional(),

	prefixes: z.object({
		allocation: z.enum(['sequential', 'random']).default('sequential'),
		v4: z.string(),
		v6: z.string(),
	}),

	dns_config: z.object({
		override_local_dns: z.boolean().default(true),
		nameservers: z.array(z.string()).default([]),
		restricted_nameservers: z.record(z.array(z.string())).default({}),
		domains: z.array(z.string()).default([]),
		extra_records: z.array(z.object({
			name: z.string(),
			type: z.literal('A'),
			value: z.string(),
		})).default([]),
		magic_dns: z.boolean().default(false),
		base_domain: z.string().default('headscale.net'),
	}),

	oidc: z.object({
		only_start_if_oidc_is_available: z.boolean().default(true),
		issuer: z.string().optional(),
		client_id: z.string().optional(),
		client_secret: z.string().optional(),
		client_secret_path: z.string().optional(),
		scope: z.array(z.string()).default(['openid', 'profile', 'email']),
		extra_params: z.record(z.string()).default({}),
		allowed_domains: z.array(z.string()).optional(),
		allowed_users: z.array(z.string()).optional(),
		allowed_groups: z.array(z.string()).optional(),
		strip_email_domain: z.boolean().default(true),
		expiry: z.union([z.string(), z.literal(0)]).default('180d'),
		use_expiry_from_token: z.boolean().default(false),
	}).optional(),

	database: z.union([
		z.object({
			type: z.literal('sqlite'),
			debug: z.boolean().default(false),
			sqlite: z.object({
				path: z.string(),
			}),
		}),
		z.object({
			type: z.literal('sqlite3'),
			debug: z.boolean().default(false),
			sqlite: z.object({
				path: z.string(),
			}),
		}),
		z.object({
			type: z.literal('postgres'),
			debug: z.boolean().default(false),
			postgres: z.object({
				host: z.string(),
				port: z.number(),
				name: z.string(),
				user: z.string(),
				pass: z.string(),
				ssl: z.boolean().default(false),
				max_open_conns: z.number().default(10),
				max_idle_conns: z.number().default(10),
				conn_max_idle_time_secs: z.number().default(3600),
			}),
		}),
	]),

	derp: z.object({
		server: z.object({
			enabled: z.boolean().default(false),
			region_id: z.number().optional(),
			region_code: z.string().optional(),
			region_name: z.string().optional(),
			stun_listen_addr: z.string().optional(),
			private_key_path: z.string().optional(),

			ipv4: z.string().optional(),
			ipv6: z.string().optional(),
			automatically_add_embedded_derp_region: z.boolean().default(true),
		}),

		urls: z.array(z.string()).optional(),
		paths: z.array(z.string()).optional(),
		auto_update_enabled: z.boolean().default(true),
		update_frequency: z.string().default('24h'),
	}),
})

export type HeadscaleConfig = z.infer<typeof HeadscaleConfig>

export let configYaml: Document | undefined
export let config: HeadscaleConfig | undefined

export async function loadConfig() {
	if (config) {
		return config
	}

	const path = resolve(process.env.CONFIG_FILE ?? '/etc/headscale/config.yaml')
	const data = await readFile(path, 'utf8')

	configYaml = parseDocument(data)
	config = await HeadscaleConfig.parseAsync(configYaml.toJSON())
	return config
}

// This is so obscenely dangerous, please have a check around it
export async function patchConfig(partial: Record<string, unknown>) {
	if (!configYaml || !config) {
		throw new Error('Config not loaded')
	}

	for (const [key, value] of Object.entries(partial)) {
		// If the key is something like `test.bar."foo.bar"`, then we treat
		// the foo.bar as a single key, and not as two keys, so that needs
		// to be split correctly.

		// Iterate through each character, and if we find a dot, we check if
		// the next character is a quote, and if it is, we skip until the next
		// quote, and then we skip the next character, which should be a dot.
		// If it's not a quote, we split it.
		const path = []
		let temp = ''
		let inQuote = false

		for (const element of key) {
			if (element === '"') {
				inQuote = !inQuote
			}

			if (element === '.' && !inQuote) {
				path.push(temp.replaceAll('"', ''))
				temp = ''
				continue
			}

			temp += element
		}

		// Push the remaining element
		path.push(temp.replaceAll('"', ''))
		configYaml.setIn(path, value)
	}

	config = await HeadscaleConfig.parseAsync(configYaml.toJSON())
	const path = resolve(process.env.CONFIG_FILE ?? '/etc/headscale/config.yaml')
	await writeFile(path, configYaml.toString(), 'utf8')
}
