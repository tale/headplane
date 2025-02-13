import {
	Session,
	SessionStorage,
	createCookieSessionStorage,
} from 'react-router';

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
	};
};

type SessionFlashData = {
	error: string;
};

type SessionStore = SessionStorage<SessionData, SessionFlashData>;

// TODO: Add args to this function to allow custom domain/config
let sessionStorage: SessionStore | null = null;
export function initSessionManager(secret: string, secure: boolean) {
	if (sessionStorage) {
		return;
	}

	sessionStorage = createCookieSessionStorage<SessionData, SessionFlashData>({
		cookie: {
			name: 'hp_sess',
			httpOnly: true,
			maxAge: 60 * 60 * 24, // 24 hours
			path: '/',
			sameSite: 'lax',
			secrets: [secret],
			secure,
		},
	});
}

export function getSession(cookie: string | null) {
	if (!sessionStorage) {
		throw new Error('Session manager not initialized');
	}

	return sessionStorage.getSession(cookie);
}

export async function auth(request: Request) {
	if (!sessionStorage) {
		return false;
	}

	const cookie = request.headers.get('Cookie');
	const session = await sessionStorage.getSession(cookie);
	if (!session.has('hsApiKey')) {
		return false;
	}

	return true;
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
