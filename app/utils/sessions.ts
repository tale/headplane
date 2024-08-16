import { createCookieSessionStorage } from '@remix-run/node' // Or cloudflare/deno

export type SessionData = {
	hsApiKey: string;
	authState: string;
	authNonce: string;
	authVerifier: string;
	user: {
		name: string;
		email?: string;
	};
}

type SessionFlashData = {
	error: string;
}

export const {
	getSession,
	commitSession,
	destroySession
} = createCookieSessionStorage<SessionData, SessionFlashData>(
	{
		cookie: {
			name: 'hp_sess',
			httpOnly: true,
			maxAge: 60 * 60 * 24, // 24 hours
			path: '/',
			sameSite: 'lax',
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			secrets: [process.env.COOKIE_SECRET!],
			secure: process.env.COOKIE_SECURE === 'true'
		}
	}
)

