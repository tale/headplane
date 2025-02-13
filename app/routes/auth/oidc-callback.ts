import { type LoaderFunctionArgs, redirect } from 'react-router';
import { finishAuthFlow, formatError, getRedirectUri } from '~/utils/oidc';
import { send } from '~/utils/res';
import { commitSession, getSession } from '~/utils/sessions.server';
import { hp_getConfig } from '~/utils/state';

export async function loader({ request }: LoaderFunctionArgs) {
	// Check if we have 0 query parameters
	const url = new URL(request.url);
	if (url.searchParams.toString().length === 0) {
		return redirect('/machines');
	}

	const session = await getSession(request.headers.get('Cookie'));
	if (session.has('hsApiKey')) {
		return redirect('/machines');
	}

	const { oidc } = hp_getConfig();
	if (!oidc) {
		throw new Error('An invalid OIDC configuration was provided');
	}

	const codeVerifier = session.get('oidc_code_verif');
	const state = session.get('oidc_state');
	const nonce = session.get('oidc_nonce');
	const redirectUri = session.get('oidc_redirect_uri');

	if (!codeVerifier || !state || !nonce || !redirectUri) {
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
	};

	try {
		const user = await finishAuthFlow(oidc, flowOptions);
		session.set('user', user);
		session.unset('oidc_code_verif');
		session.unset('oidc_state');
		session.unset('oidc_nonce');

		// TODO: This is breaking, to stop the "over-generation" of API
		// keys because they are currently non-deletable in the headscale
		// database. Look at this in the future once we have a solution
		// or we have permissioned API keys.
		session.set('hsApiKey', oidc.headscale_api_key);
		return redirect('/machines', {
			headers: {
				'Set-Cookie': await commitSession(session),
			},
		});
	} catch (error) {
		return new Response(JSON.stringify(formatError(error)), {
			status: 500,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}
}
