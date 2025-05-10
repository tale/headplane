// biome-ignore lint/suspicious/noExplicitAny: ArkType narrow context and inferred object typing is complex with current library API
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

	return type({
		[key]: valueTypeString,
		[pathKey]: 'string',
	}).narrow((obj: unknown, ctx) => {
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
// biome-ignore lint/suspicious/noExplicitAny: ArkType context object
const serverConfig = type({
	host: 'string.ip',
	port: type('string | number.integer').pipe((v) => Number(v)),
	'cookie_secret?': '32 <= string <= 32',
	'cookie_secret_path?': 'string',
	cookie_secure: stringToBool,
	agent: agentConfig,
}).narrow((obj, ctx: any) => {
	const key = 'cookie_secret';
	const pathKey = 'cookie_secret_path';
	const valProperty = obj[key];
	const pathProperty = obj[pathKey];

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
	if (!hasVal && !hasPath) {
		return ctx.reject(
			`Either "${key}" or "${pathKey}" must be provided for ${key}.`,
		);
	}
	return true;
});

// biome-ignore lint/suspicious/noExplicitAny: ArkType context object
const oidcConfig = type({
	issuer: 'string.url',
	client_id: 'string',
	'client_secret?': 'string',
	'client_secret_path?': 'string',
	token_endpoint_auth_method:
		'"client_secret_basic" | "client_secret_post" | "client_secret_jwt"',
	'redirect_uri?': 'string.url',
	user_storage_file: type('string').default('/var/lib/headplane/users.json'),
	disable_api_key_login: stringToBool,
	headscale_api_key: 'string',
	strict_validation: stringToBool.default(true),
})
	.narrow((obj, ctx: any) => {
		const key = 'client_secret';
		const pathKey = 'client_secret_path';
		const valProperty = obj[key];
		const pathProperty = obj[pathKey];
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
		if (obj.issuer && obj.client_id) {
			if (!hasVal && !hasPath) {
				return ctx.reject(
					`Either "${key}" or "${pathKey}" must be provided for client_secret if OIDC is configured.`,
				);
			}
		}
		return true;
	})
	.onDeepUndeclaredKey('reject');

// biome-ignore lint/suspicious/noExplicitAny: ArkType context object
const headscaleConfig = type({
	url: type('string.url').pipe((v) => (v.endsWith('/') ? v.slice(0, -1) : v)),
	'api_key?': 'string',
	'api_key_path?': 'string',
	'tls_cert_path?': 'string',
	'public_url?': 'string.url',
	'config_path?': 'string',
	config_strict: stringToBool,
})
	.narrow((obj, ctx: any) => {
		const key = 'api_key';
		const pathKey = 'api_key_path';
		const valProperty = obj[key];
		const pathProperty = obj[pathKey];
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
		return true;
	})
	.onDeepUndeclaredKey('reject');

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
	debug: stringToBool.default(false),
	server: serverConfig,
	'oidc?': oidcConfig,
	'integration?': integrationConfig,
	headscale: headscaleConfig,
}).onDeepUndeclaredKey('delete');

// --- Partial Configurations (Explicitly defined field by field) ---

// biome-ignore lint/suspicious/noExplicitAny: ArkType context object
const partialServerConfig = type({
	'host?': 'string.ip',
	'port?': type('string | number.integer').pipe((v) => Number(v)),
	'cookie_secret?': '32 <= string <= 32',
	'cookie_secret_path?': 'string',
	'cookie_secure?': stringToBool,
	'agent?': partialAgentConfig,
}).narrow((obj, ctx: any) => {
	const key = 'cookie_secret';
	const pathKey = 'cookie_secret_path';
	const valProperty = obj[key];
	const pathProperty = obj[pathKey];
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
	if (Object.keys(obj).length > 0 && !obj.agent && !obj.cookie_secure) {
		if (!hasVal && !hasPath) {
			return ctx.reject(
				`Either "${key}" or "${pathKey}" must be provided for cookie_secret if server section is present.`,
			);
		}
	}
	return true;
});

// biome-ignore lint/suspicious/noExplicitAny: ArkType context object
const partialOidcConfig = type({
	'issuer?': 'string.url',
	'client_id?': 'string',
	'client_secret?': 'string',
	'client_secret_path?': 'string',
	'token_endpoint_auth_method?':
		'"client_secret_basic" | "client_secret_post" | "client_secret_jwt"',
	'redirect_uri?': 'string.url',
	'user_storage_file?': 'string',
	'disable_api_key_login?': stringToBool,
	'headscale_api_key?': 'string',
	'strict_validation?': stringToBool,
})
	.narrow((obj, ctx: any) => {
		const key = 'client_secret';
		const pathKey = 'client_secret_path';
		const valProperty = obj[key];
		const pathProperty = obj[pathKey];
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
		if (obj.issuer && obj.client_id) {
			if (!hasVal && !hasPath) {
				return ctx.reject(
					`Either "${key}" or "${pathKey}" must be provided for client_secret when OIDC issuer and client_id are specified.`,
				);
			}
		}
		return true;
	})
	.onDeepUndeclaredKey('reject');

// biome-ignore lint/suspicious/noExplicitAny: ArkType context object
const partialHeadscaleConfig = type({
	'url?': type('string.url').pipe((v) =>
		v.endsWith('/') ? v.slice(0, -1) : v,
	),
	'api_key?': 'string',
	'api_key_path?': 'string',
	'tls_cert_path?': 'string',
	'public_url?': 'string.url',
	'config_path?': 'string',
	'config_strict?': stringToBool,
})
	.narrow((obj, ctx: any) => {
		const key = 'api_key';
		const pathKey = 'api_key_path';
		const valProperty = obj[key];
		const pathProperty = obj[pathKey];
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
		return true;
	})
	.onDeepUndeclaredKey('reject');

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
	'integration?': integrationConfig.partial(),
	'headscale?': partialHeadscaleConfig,
}).partial();

export type HeadplaneConfig = typeof headplaneConfig.infer;
export type PartialHeadplaneConfig = typeof partialHeadplaneConfig.infer;
