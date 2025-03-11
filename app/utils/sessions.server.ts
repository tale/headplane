import { Session, createCookieSessionStorage } from 'react-router';

export type SessionData = {
	hsApiKey: string;
	oidc_state: string;
	oidc_code_verif: string;
	oidc_nonce: string;
	oidc_redirect_uri: string;
	agent_onboarding: boolean;
	user: {
		subject: string;
		name: string;
		email?: string;
		username?: string;
		picture?: string;
	};
};

type SessionFlashData = {
	error: string;
};

// TODO: Domain config in cookies
const sessionStorage = createCookieSessionStorage<
	SessionData,
	SessionFlashData
>({
	cookie: {
		name: 'hp_sess',
		httpOnly: true,
		maxAge: 60 * 60 * 24, // 24 hours
		path: '/',
		sameSite: 'lax',
		secrets: [__cookie_context.cookie_secret],
		secure: __cookie_context.cookie_secure,
	},
});

export function getSession(cookie: string | null) {
	return sessionStorage.getSession(cookie);
}

export type ServerSession = Session<SessionData, SessionFlashData>;
export async function auth(request: Request) {
	const cookie = request.headers.get('Cookie');
	const session = await sessionStorage.getSession(cookie);
	if (!session.has('hsApiKey')) {
		return false;
	}

	return session;
}

export function destroySession(session: Session) {
	return sessionStorage.destroySession(session);
}

export function commitSession(session: Session, opts?: { maxAge?: number }) {
	return sessionStorage.commitSession(session, opts);
}
