import { type LoaderFunctionArgs, Session, redirect } from 'react-router';
import type { LoadContext } from '~/server';
import type { AuthSession, OidcFlowSession } from '~/server/web/sessions';
import { finishAuthFlow, formatError } from '~/utils/oidc';
import { send } from '~/utils/res';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	if (!context.oidc) {
		throw new Error('OIDC is not enabled');
	}

	// Check if we have 0 query parameters
	const url = new URL(request.url);
	if (url.searchParams.toString().length === 0) {
		return redirect('/login');
	}

	const session = await context.sessions.getOrCreate<OidcFlowSession>(request);
	if (session.get('state') !== 'flow') {
		return redirect('/login'); // Haven't started an OIDC flow
	}

	const payload = session.get('oidc')!;
	const { code_verifier, state, nonce, redirect_uri } = payload;
	if (!code_verifier || !state || !nonce || !redirect_uri) {
		return send({ error: 'Missing OIDC state' }, { status: 400 });
	}

	// Reconstruct the redirect URI using the query parameters
	// and the one we saved in the session
	const flowRedirectUri = new URL(redirect_uri);
	flowRedirectUri.search = url.search;

	const flowOptions = {
		redirect_uri: flowRedirectUri.toString(),
		code_verifier,
		state,
		nonce: nonce === '<none>' ? undefined : nonce,
	};

	try {
		const user = await finishAuthFlow(context.oidc, flowOptions);
		session.unset('oidc');
		const userSession = session as Session<AuthSession>;

		// TODO: This is breaking, to stop the "over-generation" of API
		// keys because they are currently non-deletable in the headscale
		// database. Look at this in the future once we have a solution
		// or we have permissioned API keys.
		userSession.set('user', user);
		userSession.set('api_key', context.config.oidc?.headscale_api_key!);
		userSession.set('state', 'auth');
		return redirect('/machines', {
			headers: {
				'Set-Cookie': await context.sessions.commit(userSession),
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
