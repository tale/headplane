import { type LoaderFunctionArgs, redirect } from 'react-router';
import { noContext } from '~/utils/log';
import { beginAuthFlow, getRedirectUri } from '~/utils/oidc';
import { commitSession, getSession } from '~/utils/sessions.server';
import type { AppContext } from '~server/context/app';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<AppContext>) {
	const session = await getSession(request.headers.get('Cookie'));
	if (session.has('hsApiKey')) {
		return redirect('/machines');
	}

	if (!context) {
		throw noContext();
	}

	const { oidc } = context.context;
	if (!oidc) {
		throw new Error('An invalid OIDC configuration was provided');
	}

	const redirectUri = oidc.redirect_uri ?? getRedirectUri(request);
	const data = await beginAuthFlow(oidc, redirectUri);
	session.set('oidc_code_verif', data.codeVerifier);
	session.set('oidc_state', data.state);
	session.set('oidc_nonce', data.nonce);
	session.set('oidc_redirect_uri', redirectUri);

	return redirect(data.url, {
		status: 302,
		headers: {
			'Set-Cookie': await commitSession(session),
		},
	});
}
