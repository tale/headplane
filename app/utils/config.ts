import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { parse } from 'yaml'

type Duration = `${string}s` | `${string}h` | `${string}m` | `${string}d` | `${string}y`

type Config = {
	server_url: string;
	listen_addr: string;
	metrics_listen_addr: string;
	grpc_listen_addr: string;
	grpc_allow_insecure: boolean;

	private_key_path: string;
	noise: {
		private_key_path: string;
	};

	prefixes: {
		v4: string;
		v6: string;
	};

	derp: {
		server: {
			enabled: boolean;
			region_id: number;
			region_code: string;
			region_name: string;
			stun_listen_addr: string;
		};

		urls: string[];
		paths: string[];
		auto_update_enabled: boolean;
		update_frequency: Duration;
	};

	disable_check_updates: boolean;
	epheremal_node_inactivity_timeout: Duration;
	node_update_check_interval: Duration;

	// Database is probably dangerous
	database: {
		type: 'sqlite3' | 'sqlite' | 'postgres';
		sqlite?: {
			path: string;
		};

		postgres?: {
			host: string;
			port: number;
			name: string;
			user: string;
			pass: string;
			max_open_conns: number;
			max_idle_conns: number;
			conn_max_idle_time_secs: number;
			ssl: boolean;
		};
	};

	acme_url: string;
	acme_email: string;
	tls_letsencrypt_hostname: string;
	tls_letsencrypt_cache_dir: string;
	tls_letsencrypt_challenge_type: string;
	tls_letsencrypt_listen: string;
	tls_cert_path: string;
	tls_key_path: string;

	log: {
		format: 'text' | 'json';
		level: string;
	};

	acl_policy_path: string;
	dns_config: {
		override_local_dns: boolean;
		nameservers: string[];
		restricted_nameservers: Record<string, string[]>; // Split DNS
		domains: string[];
		extra_records: Array<{
			name: string;
			type: 'A';
			value: string;
		}>;

		magic_dns: boolean;
		base_domain: string;
	};

	unix_socket: string;
	unix_socket_permission: string;

	oidc: {
		only_start_if_oidc_is_available: boolean;
		issuer: string;
		client_id: string;
		client_secret: string;
		expiry: Duration;
		use_expiry_from_token: boolean;
		scope: string[];
		extra_params: Record<string, string>;

		allowed_domains: string[];
		allowed_groups: string[];
		allowed_users: string[];

		strip_email_domain: boolean;
	};

	logtail: {
		enabled: boolean;
	};

	randomize_client_port: boolean;
}

let config: Config

export async function getConfig() {
	if (!config) {
		const path = resolve(process.env.CONFIG_FILE ?? '/etc/headscale/config.yaml')
		const data = await readFile(path, 'utf8')
		config = parse(data) as Config
	}

	return config
}
