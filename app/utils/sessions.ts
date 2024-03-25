import { createCookieSessionStorage } from '@remix-run/node' // Or cloudflare/deno

type SessionData = {
	hsApiKey: string;
	authState: string;
	authNonce: string;
	authVerifier: string;
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
			secrets: [process.env.COOKIE_SECRET!],
			secure: true
		}
	}
)

