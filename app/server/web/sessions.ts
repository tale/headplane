import { open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { exit } from 'node:process';
import {
	CookieSerializeOptions,
	Session,
	SessionStorage,
	createCookieSessionStorage,
} from 'react-router';
import log from '~/utils/log';
import { Capabilities, Roles } from './roles';

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
	private caps: Record<string, { c: Capabilities; oo?: boolean }>;
	private capsPath?: string;

	constructor(
		options: CookieOptions,
		caps: Record<string, { c: Capabilities; oo?: boolean }>,
		capsPath?: string,
	) {
		this.caps = caps;
		this.capsPath = capsPath;
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

	roleForSubject(subject: string): keyof typeof Roles | undefined {
		const role = this.caps[subject]?.c;
		if (!role) {
			return;
		}

		// We need this in string form based on Object.keys of the roles
		for (const [key, value] of Object.entries(Roles)) {
			if (value === role) {
				return key as keyof typeof Roles;
			}
		}
	}

	onboardForSubject(subject: string) {
		return this.caps[subject]?.oo ?? false;
	}

	// Given an OR of capabilities, check if the session has the required
	// capabilities. If not, return false. Can throw since it calls auth()
	async check(request: Request, capabilities: Capabilities) {
		const session = await this.auth(request);
		const { subject } = session.get('user') ?? {};
		if (!subject) {
			return false;
		}

		// This is the subject we set on API key based sessions. API keys
		// inherently imply admin access so we return true for all checks.
		if (subject === 'unknown-non-oauth') {
			return true;
		}

		// If the role does not exist, then this is a new subject that we have
		// not seen before. Since this is new, we set access to the lowest
		// level by default which is the member role.
		//
		// This also allows us to avoid configuring preventing sign ups with
		// OIDC, since the default sign up logic gives member which does not
		// have access to the UI whatsoever.
		const role = this.caps[subject];
		if (!role) {
			const memberRole = await this.registerSubject(subject);
			return (capabilities & memberRole.c) === capabilities;
		}

		return (capabilities & role.c) === capabilities;
	}

	async checkSubject(subject: string, capabilities: Capabilities) {
		// This is the subject we set on API key based sessions. API keys
		// inherently imply admin access so we return true for all checks.
		if (subject === 'unknown-non-oauth') {
			return true;
		}

		// If the role does not exist, then this is a new subject that we have
		// not seen before. Since this is new, we set access to the lowest
		// level by default which is the member role.
		//
		// This also allows us to avoid configuring preventing sign ups with
		// OIDC, since the default sign up logic gives member which does not
		// have access to the UI whatsoever.
		const role = this.caps[subject];
		if (!role) {
			const memberRole = await this.registerSubject(subject);
			return (capabilities & memberRole.c) === capabilities;
		}

		return (capabilities & role.c) === capabilities;
	}

	// This code is very simple, if the user does not exist in the database
	// file then we register it with the lowest level of access. If the user
	// database is empty, the first user to sign in will be given the owner
	// role.
	private async registerSubject(subject: string) {
		if (this.caps[subject]) {
			return this.caps[subject];
		}

		if (Object.keys(this.caps).length === 0) {
			log.debug('auth', 'First user registered as owner: %s', subject);
			this.caps[subject] = { c: Roles.owner };
			await this.flushUserDatabase();
			return this.caps[subject];
		}

		log.debug('auth', 'New user registered as member: %s', subject);
		this.caps[subject] = { c: Roles.member };
		await this.flushUserDatabase();
		return this.caps[subject];
	}

	private async flushUserDatabase() {
		if (!this.capsPath) {
			return;
		}

		const data = Object.entries(this.caps).map(([u, { c, oo }]) => ({
			u,
			c,
			oo,
		}));
		try {
			const handle = await open(this.capsPath, 'w');
			await handle.write(JSON.stringify(data));
			await handle.close();
		} catch (error) {
			log.error('config', 'Error writing user database file: %s', error);
		}
	}

	// Updates the capabilities and roles of a subject
	async reassignSubject(subject: string, role: keyof typeof Roles) {
		// Check if we are owner
		if (this.roleForSubject(subject) === 'owner') {
			return false;
		}

		this.caps[subject] = {
			...this.caps[subject], // Preserve the existing capabilities if any
			c: Roles[role],
		};

		await this.flushUserDatabase();
		return true;
	}

	// Overrides the onboarding status for a subject
	async overrideOnboarding(subject: string, onboarding: boolean) {
		this.caps[subject] = {
			...this.caps[subject], // Preserve the existing capabilities if any
			oo: onboarding,
		};
		await this.flushUserDatabase();
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

export async function createSessionStorage(
	options: CookieOptions,
	usersPath?: string,
) {
	const map: Record<
		string,
		{
			c: number;
			oo?: boolean;
		}
	> = {};
	if (usersPath) {
		// We need to load our users from the file (default to empty map)
		// We then translate each user into a capability object using the helper
		// method defined in the roles.ts file
		const data = await loadUserFile(usersPath);
		log.debug('config', 'Loaded %d users from database', data.length);

		for (const user of data) {
			map[user.u] = {
				c: user.c,
				oo: user.oo,
			};
		}
	}

	return new Sessionizer(options, map, usersPath);
}

async function loadUserFile(path: string) {
	const realPath = resolve(path);

	try {
		const handle = await open(realPath, 'a+');
		log.info('config', 'Using user database file at %s', realPath);
		await handle.close();
	} catch (error) {
		log.info('config', 'User database file not accessible at %s', realPath);
		log.debug('config', 'Error details: %s', error);
		exit(1);
	}

	try {
		const data = await readFile(realPath, 'utf8');
		const users = JSON.parse(data.trim()) as {
			u?: string;
			c?: number;
			oo?: boolean;
		}[];

		// Never trust user input
		return users.filter(
			(user) => user.u !== undefined && user.c !== undefined,
		) as {
			u: string;
			c: number;
			oo?: boolean;
		}[];
	} catch (error) {
		log.debug('config', 'Error reading user database file: %s', error);
		log.debug('config', 'Using empty user database');
		return [];
	}
}
