import * as oidc from 'openid-client';
import {
	createCookie,
	data,
	type LoaderFunctionArgs,
	redirect,
} from 'react-router';
import type { LoadContext } from '~/server';

export interface OidcCookieState {
	nonce: string;
	state: string;
}

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	try {
		await context.sessions.auth(request);
		return redirect('/');
	} catch {}

	if (!context.oidcConnector?.isValid) {
		throw data('OIDC is not enabled or misconfigured', { status: 501 });
	}

	const cookie = createCookie('__oidc_auth_flow', {
		httpOnly: true,
		maxAge: 300,
		secure: context.config.server.cookie_secure,
		domain: context.config.server.cookie_domain,
	});

	const redirectUri =
		context.config.oidc?.redirect_uri ?? getRedirectUri(request);

	const nonce = oidc.randomNonce();
	const state = oidc.randomState();

	const url = oidc.buildAuthorizationUrl(context.oidcConnector.client, {
		...(context.oidcConnector.extraParams ?? {}),
		scope: context.oidcConnector.scope,
		redirect_uri: redirectUri,
		state,
		nonce,
	});

	return redirect(url.href, {
		status: 302,
		headers: {
			'Set-Cookie': await cookie.serialize({
				state,
				nonce,
			} satisfies OidcCookieState),
		},
	});
}

function getRedirectUri(req: Request) {
	const url = new URL(`${__PREFIX__}/oidc/callback`, req.url);
	let host = req.headers.get('Host');
	if (!host) {
		host = req.headers.get('X-Forwarded-Host');
	}

	if (!host) {
		throw data(
			'Cannot determine redirect URI: no Host or X-Forwarded-Host header',
			{
				status: 500,
			},
		);
	}

	const proto = req.headers.get('X-Forwarded-Proto');
	url.protocol = proto ?? 'http:';
	url.host = host;
	return url.href;
}
