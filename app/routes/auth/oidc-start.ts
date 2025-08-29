import { createCookie, type LoaderFunctionArgs, redirect } from 'react-router';
import type { LoadContext } from '~/server';
import { beginAuthFlow, getRedirectUri } from '~/utils/oidc';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	try {
		await context.sessions.auth(request);
		return redirect('/machines');
	} catch {}

	if (!context.oidc || !context.config.oidc) {
		throw new Error('OIDC is not enabled');
	}

	const cookie = createCookie('__oidc_auth_flow', {
		httpOnly: true,
		maxAge: 300, // 5 minutes
	});

	const redirectUri =
		context.config.oidc?.redirect_uri ?? getRedirectUri(request);
	const data = await beginAuthFlow(
		context.oidc,
		redirectUri,
		context.config.oidc.scope,
		context.config.oidc.extra_params,
	);

	return redirect(data.url, {
		status: 302,
		headers: {
			'Set-Cookie': await cookie.serialize({
				state: data.state,
				nonce: data.nonce,
				code_verifier: data.codeVerifier,
				redirect_uri: redirectUri,
			}),
		},
	});
}
