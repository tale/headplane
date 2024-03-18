import { json, redirect } from '@sveltejs/kit'
import * as oauth from 'oauth4webapi'
import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import { base } from '$app/paths'

export async function GET({ url, cookies }: Parameters<RequestHandler>[0]) {
	const issuer = new URL(env.OIDC_ISSUER)
	const client = {
		client_id: env.OIDC_CLIENT_ID,
		token_endpoint_auth_method: 'client_secret_basic',
	} satisfies oauth.Client

	const response = await oauth.discoveryRequest(issuer)
	const res = await oauth.processDiscoveryResponse(issuer, response)
	if (!res.authorization_endpoint) {
		return json({ status: "Error", message: "No authorization endpoint found" }, {
			status: 400,
		})
	}

	const state = oauth.generateRandomState()
	const nonce = oauth.generateRandomNonce()
	const verifier = oauth.generateRandomCodeVerifier()
	const challenge = await oauth.calculatePKCECodeChallenge(verifier)

	const callback = new URL(`${base}/oidc/callback`, url.origin)
	const auth_url = new URL(res.authorization_endpoint)
	auth_url.searchParams.set('client_id', client.client_id)
	auth_url.searchParams.set('response_type', 'code')
	auth_url.searchParams.set('redirect_uri', callback.href)
	auth_url.searchParams.set('scope', 'openid profile email')
	auth_url.searchParams.set('code_challenge', challenge)
	auth_url.searchParams.set('code_challenge_method', 'S256')
	auth_url.searchParams.set('state', state)
	auth_url.searchParams.set('nonce', nonce)

	cookies.set('oidc_state', `${state}:${nonce}:${verifier}`, {
		path: base
	})
	return redirect(302, auth_url.toString())
}
