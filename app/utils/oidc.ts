import * as client from 'openid-client';
import { Configuration, IDToken, UserInfoResponse } from 'openid-client';
import log from '~/utils/log';

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
		log.error('auth', 'Unable to find a host header');
		log.error('auth', 'Ensure either Host or X-Forwarded-Host is set');
		throw new Error('Could not determine reverse proxy host');
	}

	const proto = req.headers.get('X-Forwarded-Proto');
	if (!proto) {
		log.warn('auth', 'No X-Forwarded-Proto header found');
		log.warn('auth', 'Assuming your Headplane instance runs behind HTTP');
	}

	url.protocol = proto ?? 'http:';
	url.host = host;
	return url.href;
}

export async function beginAuthFlow(
	config: Configuration,
	redirect_uri: string,
	token_endpoint_auth_method: string,
) {
	const codeVerifier = client.randomPKCECodeVerifier();
	const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

	const params: Record<string, string> = {
		redirect_uri,
		scope: 'openid profile email',
		code_challenge: codeChallenge,
		code_challenge_method: 'S256',
		token_endpoint_auth_method,
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
	code_verifier: string;
	state: string;
	nonce?: string;
}

export async function finishAuthFlow(
	config: Configuration,
	options: FlowOptions,
) {
	const tokens = await client.authorizationCodeGrant(
		config,
		new URL(options.redirect_uri),
		{
			pkceCodeVerifier: options.code_verifier,
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
		username: calculateUsername(claims, user),
		picture: user.picture,
	};
}

function calculateUsername(claims: IDToken, user: UserInfoResponse) {
	if (user.preferred_username) {
		return user.preferred_username;
	}

	if (
		claims.preferred_username &&
		typeof claims.preferred_username === 'string'
	) {
		return claims.preferred_username;
	}

	if (user.email) {
		return user.email.split('@')[0];
	}

	if (claims.email && typeof claims.email === 'string') {
		return claims.email.split('@')[0];
	}

	return;
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

	log.error('auth', 'Unknown error: %s', error);
	return {
		code: 500,
		error: {
			name: 'Internal Server Error',
			description: 'An unknown error occurred',
		},
	};
}
