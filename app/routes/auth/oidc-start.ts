import { type LoaderFunctionArgs, data, redirect } from 'react-router';
import { commitSession, getSession } from '~/utils/sessions.server';
import { send } from '~/utils/res';
import { beginAuthFlow, getRedirectUri } from '~/utils/oidc';
import { loadContext } from '~/utils/config/headplane';

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	if (session.has('hsApiKey')) {
		return redirect('/machines')
	}

	// This is a hold-over from the old code
	// TODO: Rewrite checkOIDC in the context loader
	const { oidc } = await loadContext();
	if (!oidc) {
		throw new Error('An invalid OIDC configuration was provided');
	}

	const oidcConfig = {
		issuer: oidc.issuer,
		clientId: oidc.client,
		clientSecret: oidc.secret,
		redirectUri: oidc.redirectUri,
		tokenEndpointAuthMethod: oidc.method,
	}

	const redirectUri = oidcConfig.redirectUri ?? getRedirectUri(request);
	const data = await beginAuthFlow(oidcConfig, redirectUri);
	session.set('oidc_code_verif', data.codeVerifier);
	session.set('oidc_state', data.state);
	session.set('oidc_nonce', data.nonce);
	session.set('oidc_redirect_uri', redirectUri)

	return redirect(data.url, {
		status: 302,
		headers: {
			'Set-Cookie': await commitSession(session),
		},
	});
}
