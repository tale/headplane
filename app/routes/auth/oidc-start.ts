import { type LoaderFunctionArgs, redirect } from 'react-router';
import { beginAuthFlow, getRedirectUri } from '~/utils/oidc';
import { send } from '~/utils/res';
import { commitSession, getSession } from '~/utils/sessions.server';
import { hp_getConfig, hp_getSingleton } from '~server/context/global';

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	if (session.has('hsApiKey')) {
		return redirect('/machines');
	}

	const { oidc } = hp_getConfig();
	try {
		if (!oidc) {
			throw new Error('OIDC is not enabled');
		}

		hp_getSingleton('oidc_client');
	} catch {
		return send({ error: 'OIDC is not enabled' }, { status: 400 });
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
