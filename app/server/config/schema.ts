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
	data_path: 'string = "/var/lib/headplane/"',
	cookie_secret: '(32 <= string <= 32)?',
	cookie_secret_path: 'string?',
	cookie_secure: stringToBool,
})
	.narrow((obj: Record<string, unknown>, ctx: any) => {
		const hasVal = obj.cookie_secret != null && `${obj.cookie_secret}` !== '';
		const hasPath =
			obj.cookie_secret_path != null && obj.cookie_secret_path !== '';
		if (hasVal && hasPath)
			return ctx.reject(
				`Only one of "cookie_secret" or "cookie_secret_path" may be set.`,
			);
		if (!hasVal && !hasPath)
			return ctx.reject(
				`Either "cookie_secret" or "cookie_secret_path" must be provided for cookie_secret.`,
			);
		return true;
	})
	.onDeepUndeclaredKey('reject');

const partialServerConfig = type({
	host: 'string.ip?',
	port: type('string | number.integer')
		.pipe((v) => Number(v))
		.optional(),
	data_path: 'string = "/var/lib/headplane/"',
	cookie_secret: '32 <= string <= 32?',
	cookie_secret_path: 'string?',
	cookie_secure: stringToBool.optional(),
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
	headscale_api_key: 'string?',
	headscale_api_key_path: 'string?',
	profile_picture_source: '"oidc" | "gravatar" = "oidc"',
	strict_validation: stringToBool.default(true),
	scope: 'string = "openid email profile"',
	extra_params: 'Record<string, string>?',
	authorization_endpoint: 'string.url?',
	token_endpoint: 'string.url?',
	userinfo_endpoint: 'string.url?',
})
	.narrow((obj: Record<string, unknown>, ctx: any) => {
		const hasVal =
			obj.headscale_api_key != null && `${obj.headscale_api_key}` !== '';
		const hasPath =
			obj.headscale_api_key_path != null && obj.headscale_api_key_path !== '';
		if (hasVal && hasPath)
			return ctx.reject(
				`Only one of "headscale_api_key" or "headscale_api_key_path" may be set.`,
			);
		if (!hasVal && !hasPath)
			return ctx.reject(
				`Either "headscale_api_key" or "headscale_api_key_path" must be provided.`,
			);
		return true;
	})
	.onDeepUndeclaredKey('reject');

const partialOidcConfig = type({
	issuer: 'string.url?',
	client_id: 'string?',
	client_secret: 'string?',
	client_secret_path: 'string?',
	token_endpoint_auth_method:
		'"client_secret_basic" | "client_secret_post" | "client_secret_jwt"?',
	redirect_uri: 'string.url?',
	user_storage_file: 'string?',
	disable_api_key_login: stringToBool.optional(),
	headscale_api_key: 'string?',
	headscale_api_key_path: 'string?',
	profile_picture_source: '("oidc" | "gravatar")?',
	strict_validation: stringToBool.default(true),
	scope: 'string?',
	extra_params: 'Record<string, string>?',
	authorization_endpoint: 'string.url?',
	token_endpoint: 'string.url?',
	userinfo_endpoint: 'string.url?',
});

const headscaleConfig = type({
	url: type('string.url').pipe((v) => (v.endsWith('/') ? v.slice(0, -1) : v)),
	tls_cert_path: 'string?',
	public_url: 'string.url?',
	config_path: 'string?',
	config_strict: stringToBool,
	dns_records_path: 'string?',
}).onDeepUndeclaredKey('reject');

const partialHeadscaleConfig = type({
	url: type('string.url')
		.pipe((v) => (v.endsWith('/') ? v.slice(0, -1) : v))
		.optional(),
	tls_cert_path: 'string?',
	public_url: 'string.url?',
	config_path: 'string?',
	config_strict: stringToBool.optional(),
	dns_records_path: 'string?',
});

const agentConfig = type({
	enabled: stringToBool.default(false),
	host_name: 'string = "headplane-agent"',
	pre_authkey: 'string?',
	pre_authkey_path: 'string?',
	cache_ttl: 'number.integer = 180000',
	cache_path: 'string = "/var/lib/headplane/agent_cache.json"',
	executable_path: 'string = "/usr/libexec/headplane/agent"',
	work_dir: 'string = "/var/lib/headplane/agent"',
})
	.narrow((obj: Record<string, unknown>, ctx: any) => {
		const hasVal = obj.pre_authkey != null && `${obj.pre_authkey}` !== '';
		const hasPath = obj.pre_authkey_path != null && obj.pre_authkey_path !== '';
		if (hasVal && hasPath)
			return ctx.reject(
				`Only one of "pre_authkey" or "pre_authkey_path" may be set.`,
			);
		if (!hasVal && !hasPath)
			return ctx.reject(
				`Either "pre_authkey" or "pre_authkey_path" must be provided.`,
			);
		return true;
	})
	.onDeepUndeclaredKey('reject');

const partialAgentConfig = type({
	enabled: stringToBool.default(false),
	host_name: 'string = "headplane-agent"',
	pre_authkey: 'string?',
	pre_authkey_path: 'string?',
	cache_ttl: 'number.integer = 180000',
	cache_path: 'string = "/var/lib/headplane/agent_cache.json"',
	executable_path: 'string = "/usr/libexec/headplane/agent"',
	work_dir: 'string = "/var/lib/headplane/agent"',
});

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
	server: partialServerConfig,
	'oidc?': partialOidcConfig,
	'integration?': partialIntegrationConfig,
	headscale: partialHeadscaleConfig,
}).partial();

export type HeadplaneConfig = typeof headplaneConfig.infer;
export type PartialHeadplaneConfig = typeof partialHeadplaneConfig.infer;
