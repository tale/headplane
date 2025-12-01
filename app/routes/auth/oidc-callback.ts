import { createHash } from 'node:crypto';
import { count, eq } from 'drizzle-orm';
import { createCookie, type LoaderFunctionArgs, redirect } from 'react-router';
import { ulid } from 'ulidx';
import type { LoadContext } from '~/server';
import { HeadplaneConfig } from '~/server/config/config-schema';
import { users } from '~/server/db/schema';
import { Roles } from '~/server/web/roles';
import { FlowUser, finishAuthFlow, formatError } from '~/utils/oidc';
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
	if (!context.oidc || typeof context.oidc === 'string') {
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
		let user = await finishAuthFlow(context.oidc, flowOptions);
		user = {
			...user,
			picture: setOidcPictureForSource(
				user,
				context.config.oidc?.profile_picture_source ?? 'oidc',
			),
		};

		const [{ count: userCount }] = await context.db
			.select({ count: count() })
			.from(users)
			.where(eq(users.caps, Roles.owner));

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
					api_key: context.config.oidc!.headscale_api_key,
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

type PictureSource = NonNullable<
	HeadplaneConfig['oidc']
>['profile_picture_source'];

function setOidcPictureForSource(user: FlowUser, source: PictureSource) {
	// Already set by default in the callback, so we can just return it
	if (source === 'oidc') {
		return user.picture;
	}

	if (source === 'gravatar') {
		if (!user.email) {
			return undefined;
		}

		const emailHash = user.email.trim().toLowerCase();
		const hash = createHash('sha256').update(emailHash).digest('hex');
		return `https://www.gravatar.com/avatar/${hash}?s=200&d=identicon&r=x`;
	}

	return undefined;
}
