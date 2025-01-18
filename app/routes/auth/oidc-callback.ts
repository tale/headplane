import { type LoaderFunctionArgs, redirect } from 'react-router';
import { loadContext } from '~/utils/config/headplane';
import { getSession, commitSession } from '~/utils/sessions.server';
import { finishAuthFlow, getRedirectUri, formatError } from '~/utils/oidc';
import { send } from '~/utils/res';

export async function loader({ request }: LoaderFunctionArgs) {
	// Check if we have 0 query parameters
	const url = new URL(request.url);
	if (url.searchParams.toString().length === 0) {
		return redirect('/machines');
	}

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

	const codeVerifier = session.get('oidc_code_verif');
	const state = session.get('oidc_state');
	const nonce = session.get('oidc_nonce');
	const redirectUri = session.get('oidc_redirect_uri');

	if (!codeVerifier || !state || !nonce) {
		return send({ error: 'Missing OIDC state' }, { status: 400 });
	}

	// Reconstruct the redirect URI using the query parameters
	// and the one we saved in the session
	const flowRedirectUri = new URL(redirectUri);
	flowRedirectUri.search = url.search;

	const flowOptions = {
		redirect_uri: flowRedirectUri.toString(),
		codeVerifier,
		state,
		nonce: nonce === '<none>' ? undefined : nonce,
	}

	try {
		const user = await finishAuthFlow(oidcConfig, flowOptions);
		session.set('user', user);
		session.unset('oidc_code_verif');
		session.unset('oidc_state');
		session.unset('oidc_nonce');

		// TODO: This is breaking, to stop the "over-generation" of API
		// keys because they are currently non-deletable in the headscale
		// database. Look at this in the future once we have a solution
		// or we have permissioned API keys.
		session.set('hsApiKey', oidc.rootKey);
		return redirect('/machines', {
			headers: {
				'Set-Cookie': await commitSession(session),
			},
		});
	} catch (error) {
		return new Response(
			JSON.stringify(formatError(error)),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json',
				},
			}
		);
	}
}
