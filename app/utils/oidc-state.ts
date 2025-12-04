import { createCookie } from 'react-router';
import type { HeadplaneConfig } from '~/server/config/config-schema';

export interface OidcStateCookie {
	nonce: string;
	state: string;
	verifier: string;
	redirect_uri: string;
}

export function createOidcStateCookie(config: HeadplaneConfig) {
	const cookie = createCookie('__oidc_state', {
		httpOnly: true,
		maxAge: 1800,
		secure: config.server.cookie_secure,
		domain: config.server.cookie_domain,
		path: `${__PREFIX__}/oidc/callback`,
	});

	return {
		...cookie,
		serialize: async (value: OidcStateCookie): Promise<string> => {
			return cookie.serialize(value);
		},

		parse: async (
			cookieHeader: string | null,
		): Promise<OidcStateCookie | null> => {
			const parsed = await cookie.parse(cookieHeader);
			if (
				parsed == null ||
				typeof parsed !== 'object' ||
				typeof parsed.nonce !== 'string' ||
				typeof parsed.state !== 'string' ||
				typeof parsed.verifier !== 'string' ||
				typeof parsed.redirect_uri !== 'string'
			) {
				return null;
			}

			return {
				nonce: parsed.nonce,
				state: parsed.state,
				verifier: parsed.verifier,
				redirect_uri: parsed.redirect_uri,
			};
		},
	};
}
