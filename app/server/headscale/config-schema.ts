import { type } from 'arktype';

const goBool = type('boolean | "true" | "false"').pipe((v) => {
	if (v === 'true') return true;
	if (v === 'false') return false;
	return v;
});

const goDuration = type('0 | string').pipe((v) => {
	return v.toString();
});

const databaseConfig = type({
	type: '"sqlite" | "sqlite3"',
	sqlite: {
		path: 'string',
		write_head_log: goBool.default(true),
		wal_autocheckpoint: 'number = 1000',
	},
})
	.or({
		type: '"postgres"',
		postgres: {
			host: 'string',
			port: 'number | ""',
			name: 'string',
			user: 'string',
			pass: 'string',
			max_open_conns: 'number = 10',
			max_idle_conns: 'number = 10',
			conn_max_idle_time_secs: 'number = 3600',
			ssl: goBool.default(false),
		},
	})
	.merge({
		debug: goBool.default(false),
		'gorm?': {
			prepare_stmt: goBool.default(true),
			parameterized_queries: goBool.default(true),
			skip_err_record_not_found: goBool.default(true),
			slow_threshold: 'number = 1000',
		},
	});

// Not as strict parsing because we just need the values
// to be slightly truthy enough to safely modify them
export type HeadscaleConfig = typeof headscaleConfig.infer;
export const headscaleConfig = type({
	server_url: 'string',
	listen_addr: 'string',
	'metrics_listen_addr?': 'string',
	grpc_listen_addr: 'string = ":50433"',
	grpc_allow_insecure: goBool.default(false),
	noise: {
		private_key_path: 'string',
	},
	prefixes: {
		v4: 'string?',
		v6: 'string?',
		allocation: '"sequential" | "random" = "sequential"',
	},
	derp: {
		server: {
			enabled: goBool.default(true),
			region_id: 'number?',
			region_code: 'string?',
			region_name: 'string?',
			stun_listen_addr: 'string?',
			private_key_path: 'string?',
			ipv4: 'string?',
			ipv6: 'string?',
			automatically_add_embedded_derp_region: goBool.default(true),
		},
		urls: 'string[]?',
		paths: 'string[]?',
		auto_update_enabled: goBool.default(true),
		update_frequency: goDuration.default('24h'),
	},

	disable_check_updates: goBool.default(false),
	ephemeral_node_inactivity_timeout: goDuration.default('30m'),
	database: databaseConfig,

	acme_url: 'string = "https://acme-v02.api.letsencrypt.org/directory"',
	acme_email: 'string = ""',
	tls_letsencrypt_hostname: 'string = ""',
	tls_letsencrypt_cache_dir: 'string = "/var/lib/headscale/cache"',
	tls_letsencrypt_challenge_type: 'string = "HTTP-01"',
	tls_letsencrypt_listen: 'string = ":http"',
	'tls_cert_path?': 'string',
	'tls_key_path?': 'string',

	log: type({
		format: 'string = "text"',
		level: 'string = "info"',
	}).default(() => ({ format: 'text', level: 'info' })),

	'policy?': {
		mode: '"database" | "file" = "file"',
		path: 'string?',
	},

	dns: {
		magic_dns: goBool.default(true),
		base_domain: 'string = "headscale.net"',
		nameservers: type({
			global: type('string[]').default(() => []),
			split: type('Record<string, string[]>').default(() => ({})),
		}).default(() => ({ global: [], split: {} })),
		search_domains: type('string[]').default(() => []),
		extra_records: type({
			name: 'string',
			value: 'string',
			type: 'string | "A"',
		})
			.array()
			.default(() => []),
	},

	unix_socket: 'string?',
	unix_socket_permission: 'string = "0770"',

	'oidc?': {
		only_start_if_oidc_is_available: goBool.default(false),
		issuer: 'string',
		client_id: 'string',
		client_secret: 'string?',
		client_secret_path: 'string?',
		expiry: goDuration.default('180d'),
		use_expiry_from_token: goBool.default(false),
		scope: type('string[]').default(() => ['openid', 'email', 'profile']),
		extra_params: 'Record<string, string>?',
		allowed_domains: 'string[]?',
		allowed_groups: 'string[]?',
		allowed_users: 'string[]?',
		'pkce?': {
			enabled: goBool.default(false),
			method: 'string = "S256"',
		},
		map_legacy_users: goBool.default(false),
	},

	'logtail?': {
		enabled: goBool.default(false),
	},

	randomize_client_port: goBool.default(false),
});
