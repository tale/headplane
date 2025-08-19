import { count } from 'drizzle-orm';
import { createCookie, type LoaderFunctionArgs, redirect } from 'react-router';
import { ulid } from 'ulidx';
import type { LoadContext } from '~/server';
import { users } from '~/server/db/schema';
import { Roles } from '~/server/web/roles';
import { finishAuthFlow, formatError } from '~/utils/oidc';
import { send } from '~/utils/res';

interface OidcFlowSession {
	state: string;
	nonce: string;
	code_verifier: string;
	redirect_uri: string;
}

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

	const cookie = createCookie('__oidc_auth_flow', {
		httpOnly: true,
		maxAge: 300, // 5 minutes
	});

	const data: OidcFlowSession | null = await cookie.parse(
		request.headers.get('Cookie'),
	);

	if (data === null) {
		console.warn('OIDC flow session not found');
		return redirect('/login');
	}

	const { code_verifier, state, nonce, redirect_uri } = data;
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

		const [{ count: userCount }] = await context.db
			.select({ count: count() })
			.from(users);

		await context.db
			.insert(users)
			.values({
				id: ulid(),
				sub: user.subject,
				caps: userCount === 0 ? Roles.owner : Roles.member,
			})
			.onConflictDoNothing();

		return redirect('/machines', {
			headers: {
				'Set-Cookie': await context.sessions.createSession({
					// TODO: This is breaking, to stop the "over-generation" of API
					// keys because they are currently non-deletable in the headscale
					// database. Look at this in the future once we have a solution
					// or we have permissioned API keys.
					api_key: context.config.oidc?.headscale_api_key!,
					user,
				}),
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
