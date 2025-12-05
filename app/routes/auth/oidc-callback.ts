import { createHash } from 'node:crypto';
import { count, eq } from 'drizzle-orm';
import * as oidc from 'openid-client';
import { data, redirect } from 'react-router';
import { ulid } from 'ulidx';
import { users } from '~/server/db/schema';
import { Roles } from '~/server/web/roles';
import log from '~/utils/log';
import { createOidcStateCookie } from '~/utils/oidc-state';
import type { Route } from './+types/oidc-callback';

export async function loader({ request, context }: Route.LoaderArgs) {
	if (!context.oidcConnector?.isValid) {
		throw data('OIDC is not enabled or misconfigured', { status: 501 });
	}

	const url = new URL(request.url);
	if (url.searchParams.toString().length === 0) {
		return redirect('/login?s=error_no_query');
	}

	const cookie = createOidcStateCookie(context.config);
	const oidcCookieState = await cookie.parse(request.headers.get('Cookie'));

	if (oidcCookieState == null) {
		log.warn('auth', 'Called OIDC callback without session cookie');
		return redirect('/login?s=error_no_session');
	}

	const { state, nonce, redirect_uri, verifier } = oidcCookieState;
	if (!state || !nonce || !redirect_uri || !verifier) {
		log.warn('auth', 'OIDC session cookie is missing required fields');
		return redirect('/login?s=error_invalid_session');
	}

	try {
		const callbackUrl = new URL(redirect_uri);
		const currentUrl = new URL(request.url);
		callbackUrl.search = currentUrl.search;

		const tokens = await oidc.authorizationCodeGrant(
			context.oidcConnector.client,
			callbackUrl,
			{
				expectedState: state,
				expectedNonce: nonce,
				...(context.oidcConnector.usePKCE
					? { pkceCodeVerifier: verifier }
					: {}),
			},
		);

		const claims = tokens.claims();
		if (claims?.sub == null) {
			log.warn('auth', 'No subject found in OIDC claims');
			return redirect('/login?s=error_no_sub');
		}

		const userInfo = await oidc.fetchUserInfo(
			context.oidcConnector.client,
			tokens.access_token,
			claims.sub,
		);

		// We have defaults that closely follow what Headscale uses, maybe we
		// can make it configurable in the future, but for now we only need the
		// `sub` claim.
		const username =
			userInfo.preferred_username ?? userInfo.email?.split('@')[0] ?? 'user';
		const name =
			userInfo.name ??
			(userInfo.given_name && userInfo.family_name
				? `${userInfo.given_name} ${userInfo.family_name}`
				: (userInfo.preferred_username ?? 'SSO User'));

		const picture =
			context.config.oidc?.profile_picture_source === 'gravatar'
				? (() => {
						if (!userInfo.email) {
							return undefined;
						}

						const emailHash = userInfo.email.trim().toLowerCase();
						const hash = createHash('sha256').update(emailHash).digest('hex');
						return `https://www.gravatar.com/avatar/${hash}?s=200&d=identicon&r=x`;
					})()
				: userInfo.picture;

		const [{ count: userCount }] = await context.db
			.select({ count: count() })
			.from(users)
			.where(eq(users.caps, Roles.owner));

		await context.db
			.insert(users)
			.values({
				id: ulid(),
				sub: claims.sub,
				caps: userCount === 0 ? Roles.owner : Roles.member,
			})
			.onConflictDoNothing();

		return redirect('/', {
			headers: {
				'Set-Cookie': await context.sessions.createSession({
					api_key: context.oidcConnector.apiKey,
					user: {
						subject: claims.sub,
						username,
						name,
						email: userInfo.email,
						picture,
					},
				}),
			},
		});
	} catch (error) {
		if (error instanceof oidc.ResponseBodyError) {
			log.error(
				'auth',
				'Got an OIDC response error body: %s',
				JSON.stringify(error.cause),
			);
		} else if (error instanceof oidc.AuthorizationResponseError) {
			log.error(
				'auth',
				'Got an OIDC authorization response error: %s',
				error.error,
			);
		} else if (error instanceof oidc.WWWAuthenticateChallengeError) {
			log.error('auth', 'Got an OIDC WWW-Authenticate challenge error');
		} else if (error instanceof oidc.ClientError) {
			log.error(
				'auth',
				'Got an OIDC authorization client error: %s',
				error.cause.message,
			);
		} else {
				log.error(
				'auth',
				'Got an OIDC error: %s',
				JSON.stringify(error.cause),
			);
		}
		return redirect('/login?s=error_auth_failed');
	}
}
