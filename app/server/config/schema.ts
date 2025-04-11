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
}).onDeepUndeclaredKey('reject');

const containerLabel = type({
	name: 'string',
	value: 'string',
}).optional();

const agentConfig = type({
	enabled: stringToBool.default(false),
	host_name: 'string = "headplane-agent"',
	pre_authkey: 'string = ""',
	cache_ttl: 'number.integer = 180000',
	cache_path: 'string = "/var/lib/headplane/agent_cache.json"',
	executable_path: 'string = "/usr/libexec/headplane/agent"',
	work_dir: 'string = "/var/lib/headplane/agent"',
});

const dockerConfig = type({
	enabled: stringToBool,
	container_name: 'string',
	socket: 'string = "unix:///var/run/docker.sock"',
	container_label: containerLabel,
});

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
}).onDeepUndeclaredKey('reject');

const partialIntegrationConfig = type({
	'docker?': dockerConfig.partial(),
	'kubernetes?': kubernetesConfig.partial(),
	'proc?': procConfig.partial(),
	'agent?': agentConfig.partial(),
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
