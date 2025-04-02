import { type } from 'arktype';

const stringToBool = type('string | boolean').pipe((v) => Boolean(v));
const serverConfig = type({
	host: 'string.ip',
	port: type('string | number.integer').pipe((v) => Number(v)),
	cookie_secret: '32 <= string <= 32',
	cookie_secure: stringToBool,
	agent: type({
		authkey: 'string = ""',
		ttl: 'number.integer = 180000', // Default to 3 minutes
		cache_path: 'string = "/var/lib/headplane/agent_cache.json"',
	})
		.onDeepUndeclaredKey('reject')
		.default(() => ({
			authkey: '',
			ttl: 180000,
			cache_path: '/var/lib/headplane/agent_cache.json',
		})),
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

const dockerConfig = type({
	enabled: stringToBool,
	container_name: 'string',
	socket: 'string = "unix:///var/run/docker.sock"',
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
}).onDeepUndeclaredKey('reject');

const partialIntegrationConfig = type({
	'docker?': dockerConfig.partial(),
	'kubernetes?': kubernetesConfig.partial(),
	'proc?': procConfig.partial(),
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
