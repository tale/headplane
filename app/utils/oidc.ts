import { readFile } from 'node:fs/promises';
import * as client from 'openid-client';
import { hp_getSingleton, hp_setSingleton } from '~server/context/global';
import { HeadplaneConfig } from '~server/context/parser';
import log from '~server/utils/log';

type OidcConfig = NonNullable<HeadplaneConfig['oidc']>;
declare global {
	const __PREFIX__: string;
}

// We try our best to infer the callback URI of our Headplane instance
// By default it is always /<base_path>/oidc/callback
// (This can ALWAYS be overridden through the OidcConfig)
export function getRedirectUri(req: Request) {
	const base = __PREFIX__ ?? '/admin'; // Fallback
	const url = new URL(`${base}/oidc/callback`, req.url);
	let host = req.headers.get('Host');
	if (!host) {
		host = req.headers.get('X-Forwarded-Host');
	}

	if (!host) {
		log.error('OIDC', 'Unable to find a host header');
		log.error('OIDC', 'Ensure either Host or X-Forwarded-Host is set');
		throw new Error('Could not determine reverse proxy host');
	}

	const proto = req.headers.get('X-Forwarded-Proto');
	if (!proto) {
		log.warn('OIDC', 'No X-Forwarded-Proto header found');
		log.warn('OIDC', 'Assuming your Headplane instance runs behind HTTP');
	}

	url.protocol = proto ?? 'http:';
	url.host = host;
	return url.href;
}

let oidcSecret: string | undefined = undefined;
export function getOidcSecret() {
	return oidcSecret;
}

async function resolveClientSecret(oidc: OidcConfig) {
	if (!oidc.client_secret && !oidc.client_secret_path) {
		return;
	}

	if (oidc.client_secret_path) {
		// We need to interpolate environment variables into the path
		// Path formatting can be like ${ENV_NAME}/path/to/secret
		let path = oidc.client_secret_path;
		const matches = path.match(/\${(.*?)}/g);

		if (matches) {
			for (const match of matches) {
				const env = match.slice(2, -1);
				const value = process.env[env];
				if (!value) {
					log.error('CFGX', 'Environment variable %s is not set', env);
					return;
				}

				log.debug('CFGX', 'Interpolating %s with %s', match, value);
				path = path.replace(match, value);
			}
		}

		try {
			log.debug('CFGX', 'Reading client secret from %s', path);
			const secret = await readFile(path, 'utf-8');
			if (secret.trim().length === 0) {
				log.error('CFGX', 'Empty OIDC client secret');
				return;
			}

			oidcSecret = secret;
		} catch (error) {
			log.error('CFGX', 'Failed to read client secret from %s', path);
			log.error('CFGX', 'Error: %s', error);
			log.debug('CFGX', 'Error details: %o', error);
		}
	}

	if (oidc.client_secret) {
		oidcSecret = oidc.client_secret;
	}
}

function clientAuthMethod(
	method: string,
): (secret: string) => client.ClientAuth {
	switch (method) {
		case 'client_secret_post':
			return client.ClientSecretPost;
		case 'client_secret_basic':
			return client.ClientSecretBasic;
		case 'client_secret_jwt':
			return client.ClientSecretJwt;
		default:
			throw new Error('Invalid client authentication method');
	}
}

export async function beginAuthFlow(oidc: OidcConfig, redirect_uri: string) {
	const config = hp_getSingleton('oidc_client');
	const codeVerifier = client.randomPKCECodeVerifier();
	const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

	const params: Record<string, string> = {
		redirect_uri,
		scope: 'openid profile email',
		code_challenge: codeChallenge,
		code_challenge_method: 'S256',
		token_endpoint_auth_method: oidc.token_endpoint_auth_method,
		state: client.randomState(),
	};

	// PKCE is backwards compatible with non-PKCE servers
	// so if we don't support it, just set our nonce
	if (!config.serverMetadata().supportsPKCE()) {
		params.nonce = client.randomNonce();
	}

	const url = client.buildAuthorizationUrl(config, params);
	return {
		url: url.href,
		codeVerifier,
		state: params.state,
		nonce: params.nonce ?? '<none>',
	};
}

interface FlowOptions {
	redirect_uri: string;
	codeVerifier: string;
	state: string;
	nonce?: string;
}

export async function finishAuthFlow(oidc: OidcConfig, options: FlowOptions) {
	const config = hp_getSingleton('oidc_client');
	const tokens = await client.authorizationCodeGrant(
		config,
		new URL(options.redirect_uri),
		{
			pkceCodeVerifier: options.codeVerifier,
			expectedNonce: options.nonce,
			expectedState: options.state,
			idTokenExpected: true,
		},
	);

	const claims = tokens.claims();
	if (!claims?.sub) {
		throw new Error('No subject found in OIDC claims');
	}

	const user = await client.fetchUserInfo(
		config,
		tokens.access_token,
		claims.sub,
	);

	return {
		subject: user.sub,
		name: getName(user, claims),
		email: user.email ?? claims.email?.toString(),
		username: user.preferred_username ?? claims.preferred_username?.toString(),
		picture: user.picture,
	};
}

function getName(user: client.UserInfoResponse, claims: client.IDToken) {
	if (user.name) {
		return user.name;
	}

	if (claims.name && typeof claims.name === 'string') {
		return claims.name;
	}

	if (user.given_name && user.family_name) {
		return `${user.given_name} ${user.family_name}`;
	}

	if (user.preferred_username) {
		return user.preferred_username;
	}

	if (
		claims.preferred_username &&
		typeof claims.preferred_username === 'string'
	) {
		return claims.preferred_username;
	}

	return 'Anonymous';
}

export function formatError(error: unknown) {
	if (error instanceof client.ResponseBodyError) {
		return {
			code: error.code,
			error: {
				name: error.error,
				description: error.error_description,
			},
		};
	}

	if (error instanceof client.AuthorizationResponseError) {
		return {
			code: error.code,
			error: {
				name: error.error,
				description: error.error_description,
			},
		};
	}

	if (error instanceof client.WWWAuthenticateChallengeError) {
		return {
			code: error.code,
			error: {
				name: error.name,
				description: error.message,
				challenges: error.cause,
			},
		};
	}

	log.error('OIDC', 'Unknown error: %s', error);
	return {
		code: 500,
		error: {
			name: 'Internal Server Error',
			description: 'An unknown error occurred',
		},
	};
}

export async function testOidc(oidc: OidcConfig) {
	await resolveClientSecret(oidc);
	if (!oidcSecret) {
		log.debug(
			'OIDC',
			'Cannot validate OIDC configuration without a client secret',
		);
		return false;
	}

	log.debug('OIDC', 'Discovering OIDC configuration from %s', oidc.issuer);
	const secret = await resolveClientSecret(oidc);
	const config = await client.discovery(
		new URL(oidc.issuer),
		oidc.client_id,
		oidc.client_secret,
		clientAuthMethod(oidc.token_endpoint_auth_method)(oidcSecret),
	);

	const meta = config.serverMetadata();
	if (meta.authorization_endpoint === undefined) {
		return false;
	}

	log.debug('OIDC', 'Authorization endpoint: %s', meta.authorization_endpoint);
	log.debug('OIDC', 'Token endpoint: %s', meta.token_endpoint);

	if (meta.response_types_supported) {
		if (meta.response_types_supported.includes('code') === false) {
			log.error('OIDC', 'OIDC server does not support code flow');
			return false;
		}
	} else {
		log.warn('OIDC', 'OIDC server does not advertise response_types_supported');
	}

	if (meta.token_endpoint_auth_methods_supported) {
		if (
			meta.token_endpoint_auth_methods_supported.includes(
				oidc.token_endpoint_auth_method,
			) === false
		) {
			log.error(
				'OIDC',
				'OIDC server does not support %s',
				oidc.token_endpoint_auth_method,
			);

			return false;
		}
	}

	log.debug('OIDC', 'OIDC configuration is valid');
	hp_setSingleton('oidc_client', config);
	return true;
}
