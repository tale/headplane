import { redirect } from 'react-router';
import * as client from 'openid-client';
import {
	authorizationCodeGrantRequest,
	calculatePKCECodeChallenge,
	Client,
	ClientAuthenticationMethod,
	discoveryRequest,
	generateRandomCodeVerifier,
	generateRandomNonce,
	generateRandomState,
	getValidatedIdTokenClaims,
	isOAuth2Error,
	parseWwwAuthenticateChallenges,
	processAuthorizationCodeOpenIDResponse,
	processDiscoveryResponse,
	validateAuthResponse,
} from 'oauth4webapi';

import { post } from '~/utils/headscale';
import { commitSession, getSession } from '~/utils/sessions.server';
import log from '~/utils/log';

import type { HeadplaneContext } from './config/headplane';
import { z } from 'zod';

const oidcConfigSchema = z.object({
	issuer: z.string(),
	clientId: z.string(),
	clientSecret: z.string(),
	tokenEndpointAuthMethod: z
		.enum(['client_secret_post', 'client_secret_basic'])
		.default('client_secret_basic'),
	idTokenSigningAlg: z
		.enum([
			'RS256',
			'RS384',
			'RS512',
			'ES256',
			'ES384',
			'ES512',
			'PS256',
			'PS384',
			'PS512',
		])
		.default('RS256'),
	idTokenEncryptionAlg: z
		.enum(['RSA1_5', 'RSA-OAEP', 'RSA-OAEP-256'])
		.default('RSA-OAEP'),
	idTokenEncryptionEnc: z
		.enum([
			'A128CBC-HS256',
			'A192CBC-HS384',
			'A256CBC-HS512',
			'A128GCM',
			'A192GCM',
			'A256GCM',
		])
		.default('A256GCM'),
});

declare global {
	const __PREFIX__: string;
}

export type OidcConfig = z.infer<typeof oidcConfigSchema>;

// We try our best to infer the callback URI of our Headplane instance
// By default it is always /<base_path>/oidc/callback
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

export async function beginAuthFlow(oidc: OidcConfig, redirect_uri: string) {
	const config = await client.discovery(
		oidc.issuer, 
		oidc.clientId,
		oidc.clientSecret,
	);

	let codeVerifier: string, codeChallenge: string;
	codeVerifier = client.randomPKCECodeVerifier();
	codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

	let params: Record<string, string> = {
		redirect_uri,
		scope: 'openid profile email',
		code_challenge: codeChallenge,
		code_challenge_method: 'S256',
	}

	// PKCE is backwards compatible with non-PKCE servers
	// so if we don't support it, just set our nonce
	if (!config.serverMetadata().supportsPKCE()) {
		params.nonce = client.randomNonce();
	}

	const url = client.buildAuthorizationUrl(config, params);
	return {
		url: url.href,
		codeVerifier,
		nonce: params.nonce,
	};
}

interface FlowOptions {
	redirect_uri: string;
	codeVerifier: string;
	nonce?: string;
}

export async function finishAuthFlow(oidc: OidcConfig, options: FlowOptions) {
	const config = await client.discovery(
		oidc.issuer,
		oidc.clientId,
		oidc.clientSecret,
	);

	let subject: string, accessToken: string;
	const tokens = await client.authorizationCodeGrant(config, new URL(options.redirect_uri), {
		pkceCodeVerifier: options.codeVerifier,
		expectedNonce: options.nonce,
		idTokenExpected: true
	})

	console.log(tokens);
}

export async function startOidc(oidc: OidcConfig, req: Request) {
	const session = await getSession(req.headers.get('Cookie'));
	if (session.has('hsApiKey')) {
		return redirect('/', {
			status: 302,
			headers: {
				'Set-Cookie': await commitSession(session),
			},
		});
	}


	// TODO: Properly validate the method is a valid type
	const method = oidc.method as ClientAuthenticationMethod;
	const issuerUrl = new URL(oidc.issuer);
	const oidcClient = {
		client_id: oidc.client,
		token_endpoint_auth_method: method,
	} satisfies Client;

	const response = await discoveryRequest(issuerUrl);
	const processed = await processDiscoveryResponse(issuerUrl, response);
	if (!processed.authorization_endpoint) {
		throw new Error('No authorization endpoint found on the OIDC provider');
	}

	const state = generateRandomState();
	const nonce = generateRandomNonce();
	const verifier = generateRandomCodeVerifier();
	const challenge = await calculatePKCECodeChallenge(verifier);

	const callback = new URL('/admin/oidc/callback', req.url);
	callback.protocol = req.headers.get('X-Forwarded-Proto') ?? 'http:';
	callback.host = req.headers.get('Host') ?? '';
	const authUrl = new URL(processed.authorization_endpoint);

	authUrl.searchParams.set('client_id', oidcClient.client_id);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('redirect_uri', callback.href);
	authUrl.searchParams.set('scope', 'openid profile email');
	authUrl.searchParams.set('code_challenge', challenge);
	authUrl.searchParams.set('code_challenge_method', 'S256');
	authUrl.searchParams.set('state', state);
	authUrl.searchParams.set('nonce', nonce);

	session.set('authState', state);
	session.set('authNonce', nonce);
	session.set('authVerifier', verifier);

	return redirect(authUrl.href, {
		status: 302,
		headers: {
			'Set-Cookie': await commitSession(session),
		},
	});
}

export async function finishOidc(oidc: OidcConfig, req: Request) {
	const session = await getSession(req.headers.get('Cookie'));
	if (session.has('hsApiKey')) {
		return redirect('/', {
			status: 302,
			headers: {
				'Set-Cookie': await commitSession(session),
			},
		});
	}

	// TODO: Properly validate the method is a valid type
	const method = oidc.method as ClientAuthenticationMethod;
	const issuerUrl = new URL(oidc.issuer);
	const oidcClient = {
		client_id: oidc.client,
		client_secret: oidc.secret,
		token_endpoint_auth_method: method,
	} satisfies Client;

	const response = await discoveryRequest(issuerUrl);
	const processed = await processDiscoveryResponse(issuerUrl, response);
	if (!processed.authorization_endpoint) {
		throw new Error('No authorization endpoint found on the OIDC provider');
	}

	const state = session.get('authState');
	const nonce = session.get('authNonce');
	const verifier = session.get('authVerifier');
	if (!state || !nonce || !verifier) {
		throw new Error('No OIDC state found in the session');
	}

	const parameters = validateAuthResponse(
		processed,
		oidcClient,
		new URL(req.url),
		state,
	);

	if (isOAuth2Error(parameters)) {
		throw new Error('Invalid response from the OIDC provider');
	}

	const callback = new URL('/admin/oidc/callback', req.url);
	callback.protocol = req.headers.get('X-Forwarded-Proto') ?? 'http:';
	callback.host = req.headers.get('Host') ?? '';

	const tokenResponse = await authorizationCodeGrantRequest(
		processed,
		oidcClient,
		parameters,
		callback.href,
		verifier,
	);

	const challenges = parseWwwAuthenticateChallenges(tokenResponse);
	if (challenges) {
		throw new Error('Recieved a challenge from the OIDC provider');
	}

	const result = await processAuthorizationCodeOpenIDResponse(
		processed,
		oidcClient,
		tokenResponse,
		nonce,
	);

	if (isOAuth2Error(result)) {
		throw new Error('Invalid response from the OIDC provider');
	}

	const claims = getValidatedIdTokenClaims(result);
	const expDate = new Date(claims.exp * 1000).toISOString();

	const keyResponse = await post<{ apiKey: string }>(
		'v1/apikey',
		oidc.rootKey,
		{
			expiration: expDate,
		},
	);

	session.set('hsApiKey', keyResponse.apiKey);
	session.set('user', {
		name: claims.name ? String(claims.name) : 'Anonymous',
		email: claims.email ? String(claims.email) : undefined,
	});

	return redirect('/machines', {
		headers: {
			'Set-Cookie': await commitSession(session),
		},
	});
}

// Runs at application startup to validate the OIDC configuration
export async function testOidc(issuer: string, client: string, secret: string) {
	const oidcClient = {
		client_id: client,
		client_secret: secret,
		token_endpoint_auth_method: 'client_secret_post',
	} satisfies Client;

	const issuerUrl = new URL(issuer);

	try {
		log.debug('OIDC', 'Checking OIDC well-known endpoint');
		const response = await discoveryRequest(issuerUrl);
		const processed = await processDiscoveryResponse(issuerUrl, response);
		if (!processed.authorization_endpoint) {
			log.debug('OIDC', 'No authorization endpoint found on the OIDC provider');
			return false;
		}

		log.debug(
			'OIDC',
			'Found auth endpoint: %s',
			processed.authorization_endpoint,
		);
		return true;
	} catch (e) {
		log.debug('OIDC', 'Validation failed: %s', e.message);
		return false;
	}
}
