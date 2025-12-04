import { type } from 'arktype';
import DockerIntegration from './integration/docker';
import KubernetesIntegration from './integration/kubernetes';
import ProcIntegration from './integration/proc';
import { deprecatedField } from './utils';

export const pathSupportedKeys = [
	'server.cookie_secret',
	'oidc.client_secret',
	'oidc.headscale_api_key',
	'integration.agent.pre_authkey',
] as const;

const serverConfig = type({
	host: 'string.ip = "0.0.0.0"',
	port: 'number.integer = 3000',
	data_path: 'string.lower = "/var/lib/headplane/"',

	cookie_secret: '(32 <= string <= 32)',
	cookie_secure: 'boolean = true',
	cookie_domain: 'string.lower?',
	cookie_max_age: 'number.integer = 86400',
});

const partialServerConfig = type({
	host: 'string.ip?',
	port: 'number.integer?',
	data_path: 'string.lower?',

	cookie_secret: '(32 <= string <= 32)?',
	cookie_secure: 'boolean?',
	cookie_domain: 'string.lower?',
	cookie_max_age: 'number.integer?',
});

const headscaleConfig = type({
	url: type('string.url').pipe((v) => (v.endsWith('/') ? v.slice(0, -1) : v)),
	public_url: type('string.url')
		.pipe((v) => (v.endsWith('/') ? v.slice(0, -1) : v))
		.optional(),
	config_path: 'string.lower?',
	config_strict: 'boolean = true',
	dns_records_path: 'string.lower?',
	tls_cert_path: 'string.lower?',
});

const partialHeadscaleConfig = type({
	url: type('string.url')
		.pipe((v) => (v.endsWith('/') ? v.slice(0, -1) : v))
		.optional(),
	public_url: type('string.url')
		.pipe((v) => (v.endsWith('/') ? v.slice(0, -1) : v))
		.optional(),
	config_path: 'string.lower?',
	config_strict: 'boolean?',
	dns_records_path: 'string.lower?',
	tls_cert_path: 'string.lower?',
});

const oidcConfig = type({
	issuer: 'string.url',
	client_id: 'string',
	client_secret: 'string',
	headscale_api_key: 'string',
	redirect_uri: 'string.url?',
	disable_api_key_login: 'boolean = false',
	scope: 'string = "openid email profile"',
	profile_picture_source: '"oidc" | "gravatar" = "oidc"',
	extra_params: 'Record<string, string>?',

	authorization_endpoint: 'string.url?',
	token_endpoint: 'string.url?',
	userinfo_endpoint: 'string.url?',

	// Old/deprecated options
	user_storage_file: 'string.lower = "/var/lib/headplane/users.json"',
	strict_validation: type('unknown').narrow(deprecatedField()).optional(),
	token_endpoint_auth_method: type('unknown')
		.narrow(deprecatedField())
		.optional(),
});

const partialOidcConfig = type({
	issuer: 'string.url?',
	client_id: 'string?',
	client_secret: 'string?',
	headscale_api_key: 'string?',
	redirect_uri: 'string.url?',
	disable_api_key_login: 'boolean?',
	scope: 'string?',
	extra_params: 'Record<string, string>?',
	profile_picture_source: '"oidc" | "gravatar"?',

	authorization_endpoint: 'string.url?',
	token_endpoint: 'string.url?',
	userinfo_endpoint: 'string.url?',

	// Old/deprecated options
	user_storage_file: 'string.lower?',
	strict_validation: type('unknown').narrow(deprecatedField()).optional(),
	token_endpoint_auth_method: type('unknown')
		.narrow(deprecatedField())
		.optional(),
});

const agentConfig = type({
	enabled: 'boolean',
	host_name: 'string = "headplane-agent"',
	pre_authkey: 'string',
	cache_ttl: 'number.integer = 180000',
	cache_path: 'string = "/var/lib/headplane/agent_cache.json"',
	executable_path: 'string = "/usr/libexec/headplane/agent"',
	work_dir: 'string = "/var/lib/headplane/agent"',
});

const partialAgentConfig = type({
	enabled: 'boolean?',
	host_name: 'string?',
	pre_authkey: 'string?',
	cache_ttl: 'number.integer?',
	cache_path: 'string?',
	executable_path: 'string?',
	work_dir: 'string?',
});

const integrationConfig = type({
	docker: DockerIntegration.configSchema.full,
	kubernetes: KubernetesIntegration.configSchema.full,
	proc: ProcIntegration.configSchema.full,
	agent: agentConfig.optional(),
}).partial();

export const partialIntegrationConfig = type({
	docker: DockerIntegration.configSchema.partial,
	kubernetes: KubernetesIntegration.configSchema.partial,
	proc: ProcIntegration.configSchema.partial,
	agent: partialAgentConfig.optional(),
}).partial();

export const headplaneConfig = type({
	debug: 'boolean = false',
	server: serverConfig,
	headscale: headscaleConfig,
	oidc: oidcConfig.optional(),
	integration: integrationConfig.optional(),
}).onDeepUndeclaredKey('delete');

export const partialHeadplaneConfig = type({
	debug: 'boolean?',
	server: partialServerConfig.optional(),
	headscale: partialHeadscaleConfig.optional(),
	oidc: partialOidcConfig.optional(),
	integration: partialIntegrationConfig.optional(),
});

export type HeadplaneConfig = typeof headplaneConfig.infer;
export type PartialHeadplaneConfig = typeof partialHeadplaneConfig.infer;

type DotNotationToObjects<
	T extends string,
	V,
> = T extends `${infer K}.${infer Rest}`
	? { [P in K]?: DotNotationToObjects<Rest, V> }
	: { [P in `${T}_path`]?: V };

type ObjectDeepMerge<T> = T extends object
	? {
			[K in keyof T]: T[K] extends object ? ObjectDeepMerge<T[K]> : T[K];
		}
	: T;

type ConfigWithPathKeys = ObjectDeepMerge<
	DotNotationToObjects<(typeof pathSupportedKeys)[number], string | undefined>
>;

export type PartialHeadplaneConfigWithPaths = PartialHeadplaneConfig &
	ConfigWithPathKeys;
