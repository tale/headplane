import * as oidc from 'openid-client';
import { data, type LoaderFunctionArgs, redirect } from 'react-router';
import type { LoadContext } from '~/server';
import { HeadplaneConfig } from '~/server/config/config-schema';
import { createOidcStateCookie } from '~/utils/oidc-state';

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

	const cookie = createOidcStateCookie(context.config);
	const redirect_uri = getRedirectUri(context.config, request);

	const nonce = oidc.randomNonce();
	const state = oidc.randomState();

	const url = oidc.buildAuthorizationUrl(context.oidcConnector.client, {
		...(context.oidcConnector.extraParams ?? {}),
		scope: context.oidcConnector.scope,
		redirect_uri,
		state,
		nonce,
	});

	return redirect(url.href, {
		status: 302,
		headers: {
			'Set-Cookie': await cookie.serialize({
				state,
				nonce,
				redirect_uri,
			}),
		},
	});
}

function getRedirectUri(config: HeadplaneConfig, req: Request): string {
	if (config.server.base_url != null) {
		const url = new URL(`${__PREFIX__}/oidc/callback`, config.server.base_url);
		return url.href;
	}

	if (config.oidc?.redirect_uri != null) {
		const url = new URL(
			`${__PREFIX__}/oidc/callback`,
			config.oidc.redirect_uri,
		);
		return url.href;
	}

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
