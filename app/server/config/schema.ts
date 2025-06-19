import { type } from 'arktype';

const stringToBool = type('string | boolean').pipe((v) => {
	if (typeof v === 'string') {
		if (v === '1' || v === 'true' || v === 'yes') {
			return true;
		}

		if (v === '0' || v === 'false' || v === 'no') {
			return false;
		}

		throw new Error(`Invalid string value for boolean: ${v}`);
	}

	return Boolean(v);
});

const serverConfig = type({
	host: 'string.ip',
	port: type('string | number.integer').pipe((v) => Number(v)),
	cookie_secret: '32 <= string <= 32',
	cookie_secure: stringToBool,
});

const oidcConfig = type({
	issuer: 'string.url',
	client_id: 'string',
	client_secret: 'string?',
	client_secret_path: 'string?',
	token_endpoint_auth_method:
		'"client_secret_basic" | "client_secret_post" | "client_secret_jwt"',
	redirect_uri: 'string.url?',
	user_storage_file: 'string = "/var/lib/headplane/users.json"',
	disable_api_key_login: stringToBool,
	headscale_api_key: 'string',
	strict_validation: stringToBool.default(true),
}).onDeepUndeclaredKey('reject');

const headscaleConfig = type({
	url: type('string.url').pipe((v) => (v.endsWith('/') ? v.slice(0, -1) : v)),
	tls_cert_path: 'string?',
	public_url: 'string.url?',
	config_path: 'string?',
	config_strict: stringToBool,
	dns_records_path: 'string?',
}).onDeepUndeclaredKey('reject');

const agentConfig = type({
	enabled: stringToBool.default(false),
	host_name: 'string = "headplane-agent"',
	pre_authkey: 'string = ""',
	cache_ttl: 'number.integer = 180000',
	cache_path: 'string = "/var/lib/headplane/agent_cache.json"',
	executable_path: 'string = "/usr/libexec/headplane/agent"',
	work_dir: 'string = "/var/lib/headplane/agent"',
});

const partialAgentConfig = type({
	enabled: stringToBool,
	host_name: 'string | undefined',
	pre_authkey: 'string | undefined',
	cache_ttl: 'number.integer | undefined',
	cache_path: 'string | undefined',
	executable_path: 'string | undefined',
	work_dir: 'string | undefined',
}).partial();

const dockerConfig = type({
	enabled: stringToBool,
	container_name: 'string = ""',
	container_label: 'string = "me.tale.headplane.target=headscale"',
	socket: 'string = "unix:///var/run/docker.sock"',
});

const partialDockerConfig = type({
	enabled: stringToBool,
	container_name: 'string | undefined',
	container_label: 'string | undefined',
	socket: 'string | undefined',
}).partial();

const kubernetesConfig = type({
	enabled: stringToBool,
	pod_name: 'string',
	validate_manifest: stringToBool,
});

const procConfig = type({
	enabled: stringToBool,
});

const integrationConfig = type({
	'docker?': dockerConfig,
	'kubernetes?': kubernetesConfig,
	'proc?': procConfig,
	'agent?': agentConfig,
});

const partialIntegrationConfig = type({
	'docker?': partialDockerConfig,
	'kubernetes?': kubernetesConfig.partial(),
	'proc?': procConfig.partial(),
	'agent?': partialAgentConfig,
}).partial();

export const headplaneConfig = type({
	debug: stringToBool,
	server: serverConfig,
	'oidc?': oidcConfig,
	'integration?': integrationConfig,
	headscale: headscaleConfig,
}).onDeepUndeclaredKey('delete');

export const partialHeadplaneConfig = type({
	debug: stringToBool,
	server: serverConfig.partial(),
	'oidc?': oidcConfig.partial(),
	'integration?': partialIntegrationConfig,
	headscale: headscaleConfig.partial(),
}).partial();

export type HeadplaneConfig = typeof headplaneConfig.infer;
export type PartialHeadplaneConfig = typeof partialHeadplaneConfig.infer;
