import { Session, SessionStorage, createCookieSessionStorage } from 'react-router';

export type SessionData = {
	hsApiKey: string;
	oidc_state: string;
	oidc_code_verif: string;
	oidc_nonce: string;
	user: {
		subject: string;
		name: string;
		email?: string;
		username?: string;
	};
};

type SessionFlashData = {
	error: string;
};

type SessionStore = SessionStorage<SessionData, SessionFlashData>;

// TODO: Add args to this function to allow custom domain/config
let sessionStorage: SessionStore | null = null;
export function initSessionManager() {
	if (sessionStorage) {
		throw new Error('Session manager already initialized');
	}

	sessionStorage = createCookieSessionStorage<SessionData, SessionFlashData>({
		cookie: {
			name: 'hp_sess',
			httpOnly: true,
			maxAge: 60 * 60 * 24, // 24 hours
			path: '/',
			sameSite: 'lax',
			secrets: [process.env.COOKIE_SECRET!],
			secure: process.env.COOKIE_SECURE !== 'false',
		},
	});
}

export function getSession(cookie: string | null) {
	if (!sessionStorage) {
		throw new Error('Session manager not initialized');
	}

	return sessionStorage.getSession(cookie);
}

export function destroySession(session: Session) {
	if (!sessionStorage) {
		throw new Error('Session manager not initialized');
	}

	return sessionStorage.destroySession(session);
}

export function commitSession(session: Session, opts?: { maxAge?: number }) {
	if (!sessionStorage) {
		throw new Error('Session manager not initialized');
	}

	return sessionStorage.commitSession(session, opts);
}
