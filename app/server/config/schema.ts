import { Type, type } from 'arktype';

// Configuration Schema for Headplane
//
// For OIDC client secret, Headplane supports two ways to provide it:
// 1. Directly in the config file or environment variable (client_secret)
// 2. As a path to a file containing the secret (client_secret_path)
//
// Only one of these should be set. If client_secret_path is provided,
// Headplane will read the secret from that file during startup.

/**
 * Generates an ArkType schema for a field that can be provided either as a direct value
 * or via a file path. Enforces mutual exclusivity and optional overall mandatoriness.
 *
 * @param key The base name for the field (e.g., "client_secret").
 * @param options Configuration options:
 *   - mandatory: If true, ensures either the direct value or the path is provided.
 *   - valueType: ArkType string for the direct value (e.g., "string", "32 <= string <= 32"). Defaults to "string".
 * @returns An ArkType Type definition for the value/path pair.
 */
function valueOrPath<Key extends string>(
	key: Key,
	options?: { mandatory?: boolean; valueType?: string },
) {
	const pathKey = `${key}_path` as const;
	const valueTypeString = options?.valueType || 'string';

	const props = {
		[`${key}?`]: valueTypeString,
		[`${pathKey}?`]: 'string',
	} as const;

	return type(props).narrow((obj: unknown, ctx) => {
		if (typeof obj !== 'object' || obj === null) {
			return ctx.reject('Expected an object');
		}

		const valProperty = (obj as Record<string, unknown>)[key];
		const pathProperty = (obj as Record<string, unknown>)[pathKey];

		const hasVal =
			valProperty !== undefined &&
			valProperty !== null &&
			(typeof valProperty === 'string' ? valProperty !== '' : true);
		const hasPath =
			pathProperty !== undefined &&
			pathProperty !== null &&
			typeof pathProperty === 'string' &&
			pathProperty !== '';

		if (hasVal && hasPath) {
			return ctx.reject(`Only one of "${key}" or "${pathKey}" may be set.`);
		}
		if (options?.mandatory && !hasVal && !hasPath) {
			return ctx.reject(
				`Either "${key}" or "${pathKey}" must be provided for ${key}.`,
			);
		}
		return true;
	});
}

const stringToBool = type('string | boolean').pipe((v) => Boolean(v));

// --- Agent Config (defined separately for clarity in partial) ---
const agentObjectDefinition = type({
	authkey: 'string = ""',
	ttl: 'number.integer = 180000',
	cache_path: 'string = "/var/lib/headplane/agent_cache.json"',
}).onDeepUndeclaredKey('reject');

const partialAgentConfig = agentObjectDefinition.partial();

const agentConfig = agentObjectDefinition.default(() => ({
	authkey: '',
	ttl: 180000,
	cache_path: '/var/lib/headplane/agent_cache.json',
}));

// --- Main Configurations ---
const serverConfig = type({
	host: 'string.ip',
	port: type('string | number.integer').pipe((v) => Number(v)),
	...valueOrPath('cookie_secret', {
		mandatory: true,
		valueType: '32 <= string <= 32',
	}),
	cookie_secure: stringToBool,
	agent: agentConfig,
});

const oidcConfig = type({
	issuer: 'string.url',
	client_id: 'string',
	...valueOrPath('client_secret', { mandatory: true }),
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
	...valueOrPath('api_key'),
	tls_cert_path: 'string?',
	public_url: 'string.url?',
	config_path: 'string?',
	config_strict: stringToBool,
}).onDeepUndeclaredKey('reject');

const containerLabel = type({
	name: 'string',
	value: 'string',
}).optional();

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
}).onDeepUndeclaredKey('reject');

export const headplaneConfig = type({
	debug: stringToBool,
	server: serverConfig,
	'oidc?': oidcConfig,
	'integration?': integrationConfig,
	headscale: headscaleConfig,
}).onDeepUndeclaredKey('delete');

// --- Partial Configurations (Explicitly defined field by field) ---

const partialServerConfig = type({
	'host?': 'string.ip',
	'port?': type('string | number.integer').pipe((v) => Number(v)),
	...valueOrPath('cookie_secret', {
		mandatory: true,
		valueType: '32 <= string <= 32',
	}),
	'cookie_secure?': stringToBool,
	'agent?': partialAgentConfig,
});

const partialOidcConfig = type({
	'issuer?': 'string.url',
	'client_id?': 'string',
	...valueOrPath('client_secret', { mandatory: true }),
	'token_endpoint_auth_method?':
		'"client_secret_basic" | "client_secret_post" | "client_secret_jwt"',
	'redirect_uri?': 'string.url?',
	'user_storage_file?': 'string = "/var/lib/headplane/users.json"',
	'disable_api_key_login?': stringToBool,
	'headscale_api_key?': 'string',
	'strict_validation?': stringToBool.default(true),
}).onDeepUndeclaredKey('reject');

const partialHeadscaleConfig = type({
	'url?': type('string.url').pipe((v) =>
		v.endsWith('/') ? v.slice(0, -1) : v,
	),
	...valueOrPath('api_key'),
	'tls_cert_path?': 'string?',
	'public_url?': 'string.url?',
	'config_path?': 'string?',
	'config_strict?': stringToBool,
}).onDeepUndeclaredKey('reject');

const partialDockerConfig = dockerConfig.partial();
const partialKubernetesConfig = kubernetesConfig.partial();
const partialProcConfig = procConfig.partial();

const partialIntegrationConfig = type({
	'docker?': partialDockerConfig,
	'kubernetes?': partialKubernetesConfig,
	'proc?': partialProcConfig,
}).partial();

export const partialHeadplaneConfig = type({
	'debug?': stringToBool,
	'server?': partialServerConfig,
	'oidc?': partialOidcConfig,
	'integration?': partialIntegrationConfig,
	'headscale?': partialHeadscaleConfig,
}).partial();

export type HeadplaneConfig = typeof headplaneConfig.infer;
export type PartialHeadplaneConfig = typeof partialHeadplaneConfig.infer;
