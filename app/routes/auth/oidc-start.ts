import { type LoaderFunctionArgs, Session, redirect } from 'react-router';
import type { LoadContext } from '~/server';
import { AuthSession, OidcFlowSession } from '~/server/web/sessions';
import { beginAuthFlow, getRedirectUri } from '~/utils/oidc';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	const session = await context.sessions.getOrCreate<OidcFlowSession>(request);
	if ((session as Session<AuthSession>).has('api_key')) {
		return redirect('/machines');
	}

	if (!context.oidc) {
		throw new Error('OIDC is not enabled');
	}

	const redirectUri =
		context.config.oidc?.redirect_uri ?? getRedirectUri(request);
	const data = await beginAuthFlow(
		context.oidc,
		redirectUri,
		// We can't get here without the OIDC config being defined
		context.config.oidc!.token_endpoint_auth_method,
	);

	session.set('state', 'flow');
	session.set('oidc', {
		state: data.state,
		nonce: data.nonce,
		code_verifier: data.codeVerifier,
		redirect_uri: redirectUri,
	});

	return redirect(data.url, {
		status: 302,
		headers: {
			'Set-Cookie': await context.sessions.commit(session),
		},
	});
}
