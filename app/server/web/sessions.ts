import {
	CookieSerializeOptions,
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

export interface OidcFlowSession {
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

	// This throws on the assumption that auth is already checked correctly
	// on something that wraps the route calling auth. The top-level routes
	// that call this are wrapped with try/catch to handle the error.
	async auth(request: Request) {
		const cookie = request.headers.get('cookie');
		const session = await this.storage.getSession(cookie);
		const type = session.get('state');
		if (!type) {
			throw new Error('Session state not found');
		}

		if (type !== 'auth') {
			throw new Error('Session is not authenticated');
		}

		return session as Session<AuthSession, Error>;
	}

	getOrCreate<T extends JoinedSession = AuthSession>(request: Request) {
		return this.storage.getSession(request.headers.get('cookie')) as Promise<
			Session<T, Error>
		>;
	}

	destroy(session: Session) {
		return this.storage.destroySession(session);
	}

	commit(session: Session, options?: CookieSerializeOptions) {
		return this.storage.commitSession(session, options);
	}
}

export function createSessionStorage(options: CookieOptions) {
	return new Sessionizer(options);
}
