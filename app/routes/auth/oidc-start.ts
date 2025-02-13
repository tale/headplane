import { type LoaderFunctionArgs, redirect } from 'react-router';
import { beginAuthFlow, getRedirectUri } from '~/utils/oidc';
import { commitSession, getSession } from '~/utils/sessions.server';
import { hp_getConfig } from '~/utils/state';

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	if (session.has('hsApiKey')) {
		return redirect('/machines');
	}

	// This is a hold-over from the old code
	// TODO: Rewrite checkOIDC in the context loader
	const { oidc } = hp_getConfig();
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
