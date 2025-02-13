import * as client from 'openid-client';
import log from '~/utils/log';
import { HeadplaneConfig } from '~/utils/state';

declare global {
	const __PREFIX__: string;
}

type OidcConfig = NonNullable<HeadplaneConfig['oidc']>;

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
	const config = await client.discovery(
		new URL(oidc.issuer),
		oidc.client_id,
		oidc.client_secret,
		clientAuthMethod(oidc.token_endpoint_auth_method)(oidc.client_secret),
	);

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
	const config = await client.discovery(
		new URL(oidc.issuer),
		oidc.client_id,
		oidc.client_secret,
		clientAuthMethod(oidc.token_endpoint_auth_method)(oidc.client_secret),
	);

	let subject: string;
	let accessToken: string;

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
		subject: claims.sub,
		name: claims.name ? String(claims.name) : 'Anonymous',
		email: claims.email ? String(claims.email) : undefined,
		username: claims.preferred_username
			? String(claims.preferred_username)
			: undefined,
	};
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
	log.debug('OIDC', 'Discovering OIDC configuration from %s', oidc.issuer);
	const config = await client.discovery(
		new URL(oidc.issuer),
		oidc.client_id,
		oidc.client_secret,
		clientAuthMethod(oidc.token_endpoint_auth_method)(oidc.client_secret),
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
	} else {
		log.warn(
			'OIDC',
			'OIDC server does not advertise token_endpoint_auth_methods_supported',
		);
	}

	log.debug('OIDC', 'OIDC configuration is valid');
	return true;
}
