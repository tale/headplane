import {
	Session,
	SessionStorage,
	createCookieSessionStorage,
} from 'react-router';

export interface AuthSession {
	state: 'auth';
	api_key: string;
	user: {
		subject: string;
		name: string;
		email?: string;
		username?: string;
		picture?: string;
	};
}

interface OidcFlowSession {
	state: 'flow';
	oidc: {
		state: string;
		nonce: string;
		code_verifier: string;
		redirect_uri: string;
	};
}

type JoinedSession = AuthSession | OidcFlowSession;
interface Error {
	error: string;
}

interface CookieOptions {
	name: string;
	secure: boolean;
	maxAge: number;
	secrets: string[];
	domain?: string;
}

class Sessionizer {
	private storage: SessionStorage<JoinedSession, Error>;
	constructor(options: CookieOptions) {
		this.storage = createCookieSessionStorage({
			cookie: {
				...options,
				httpOnly: true,
				path: __PREFIX__, // Only match on the prefix
				sameSite: 'lax', // TODO: Strictify with Domain,
			},
		});
	}

	async auth(request: Request) {
		const cookie = request.headers.get('cookie');
		const session = await this.storage.getSession(cookie);
		const type = session.get('state');
		if (!type) {
			return false;
		}

		if (type !== 'auth') {
			return false;
		}

		return session as Session<AuthSession>;
	}

	destroy(session: Session) {
		return this.storage.destroySession(session);
	}

	commit(session: Session) {
		return this.storage.commitSession(session);
	}
}

export function createSessionStorage(options: CookieOptions) {
	return new Sessionizer(options);
}
