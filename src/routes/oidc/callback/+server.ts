import { json, redirect } from '@sveltejs/kit'
import * as oauth from 'oauth4webapi'
import type { RequestHandler } from './$types'
import { generateApiKey } from '$lib/api'
import { env as publicEnv } from '$env/dynamic/public'
import { base } from "$app/paths";
import { encryptCookie } from '$lib/crypto'
import { env } from '$env/dynamic/private'

export async function GET({ url, cookies }: Parameters<RequestHandler>[0]) {
	const issuer = new URL(env.OIDC_ISSUER)
	const client = {
		client_id: env.OIDC_CLIENT_ID,
		client_secret: env.OIDC_CLIENT_SECRET,
		token_endpoint_auth_method: 'client_secret_basic',
	} satisfies oauth.Client

	const response = await oauth.discoveryRequest(issuer, { algorithm: 'oidc' })
	const res = await oauth.processDiscoveryResponse(issuer, response)
	if (!res.authorization_endpoint) {
		return json({ status: 'Error', message: "No authorization endpoint found" }, {
			status: 400,
		})
	}

	const oidc = cookies.get('oidc_state')
	if (!oidc) {
		return json({ status: 'Error', message: "No state found" }, {
			status: 400,
		})
	}

	const [state, nonce, verifier] = oidc.split(':')

	const params = oauth.validateAuthResponse(res, client, url, state)
	if (oauth.isOAuth2Error(params)) {
		console.error(params)
		return json({ status: 'Error', message: "Invalid response" }, {
			status: 400,
		})
	}

	const callback = new URL(`${base}/oidc/callback`, url.origin)
	const token_response = await oauth.authorizationCodeGrantRequest(
		res,
		client,
		params,
		callback.href,
		verifier
	)

	const challenges = oauth.parseWwwAuthenticateChallenges(token_response)
	if (challenges) {
		return json({ status: 'Error', message: "Invalid response", challenges }, {
			status: 401,
		})
	}

	const result = await oauth.processAuthorizationCodeOpenIDResponse(res, client, token_response, nonce)
	if (oauth.isOAuth2Error(result)) {
		return json({ status: 'Error', message: "Invalid response", result }, {
			status: 400,
		})
	}

	const claims = oauth.getValidatedIdTokenClaims(result)

	// Generate an API key for the user that expires in claims.exp
	const key = await generateApiKey(claims.exp, env.API_KEY);

	const value = await encryptCookie(key);
	cookies.set('hs_api_key', value, {
		path: base,
		expires: new Date(claims.exp * 1000),
		sameSite: 'lax',
		httpOnly: true,
	});

	cookies.delete('oidc_state', {
		path: `${base}/oidc`
	});

	return redirect(307, `${base}/machines`);
}
