import { createHash } from 'node:crypto';
import { open, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql/driver';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { createCookie } from 'react-router';
import { ulid } from 'ulidx';
import log from '~/utils/log';
import { users } from '../db/schema';
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

interface JWTSession {
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

interface AuthSessionOptions {
	secret: string;
	db: LibSQLDatabase;
	oidcUsersFile?: string;
	cookie: {
		name: string;
		secure: boolean;
		maxAge: number;
		domain?: string;
	};
}

class Sessionizer {
	private options: AuthSessionOptions;

	constructor(options: AuthSessionOptions) {
		this.options = options;
	}

	// This throws on the assumption that auth is already checked correctly
	// on something that wraps the route calling auth. The top-level routes
	// that call this are wrapped with try/catch to handle the error.
	async auth(request: Request) {
		return decodeSession(request, this.options);
	}

	async createSession(
		payload: JWTSession,
		maxAge = this.options.cookie.maxAge,
	) {
		// TODO: What the hell is this garbage
		return createSession(payload, {
			...this.options,
			cookie: {
				...this.options.cookie,
				maxAge,
			},
		});
	}

	async destroySession() {
		return destroySession(this.options);
	}

	async roleForSubject(
		subject: string,
	): Promise<keyof typeof Roles | undefined> {
		const [user] = await this.options.db
			.select()
			.from(users)
			.where(eq(users.sub, subject))
			.limit(1);

		if (!user) {
			return;
		}

		// We need this in string form based on Object.keys of the roles
		for (const [key, value] of Object.entries(Roles)) {
			if (value === user.caps) {
				return key as keyof typeof Roles;
			}
		}
	}

	// Given an OR of capabilities, check if the session has the required
	// capabilities. If not, return false. Can throw since it calls auth()
	async check(request: Request, capabilities: Capabilities) {
		const session = await this.auth(request);

		// This is the subject we set on API key based sessions. API keys
		// inherently imply admin access so we return true for all checks.
		if (session.user.subject === 'unknown-non-oauth') {
			return true;
		}

		const [user] = await this.options.db
			.select()
			.from(users)
			.where(eq(users.sub, session.user.subject))
			.limit(1);

		if (!user) {
			return false;
		}

		return (capabilities & user.caps) === capabilities;
	}

	// Updates the capabilities and roles of a subject
	async reassignSubject(subject: string, role: keyof typeof Roles) {
		// Check if we are owner
		const subjectRole = await this.roleForSubject(subject);
		if (subjectRole === 'owner') {
			return false;
		}

		await this.options.db
			.update(users)
			.set({
				caps: Roles[role],
			})
			.where(eq(users.sub, subject));

		return true;
	}
}

async function createSession(payload: JWTSession, options: AuthSessionOptions) {
	const secret = createHash('sha256').update(options.secret, 'utf8').digest();
	const jwt = await new EncryptJWT({
		...payload,
	})
		.setProtectedHeader({ alg: 'dir', enc: 'A256GCM', typ: 'JWT' })
		.setIssuedAt()
		.setExpirationTime('1d')
		.setIssuer('urn:tale:headplane')
		.setAudience('urn:tale:headplane')
		.setJti(ulid())
		.encrypt(secret);

	const cookie = createCookie(options.cookie.name, {
		...options.cookie,
		path: __PREFIX__,
	});

	return cookie.serialize(jwt);
}

async function decodeSession(request: Request, options: AuthSessionOptions) {
	const cookieHeader = request.headers.get('cookie');
	if (cookieHeader === null) {
		throw new Error('No session cookie found');
	}

	const cookie = createCookie(options.cookie.name, {
		...options.cookie,
		path: __PREFIX__,
	});

	const cookieValue = (await cookie.parse(cookieHeader)) as string | null;
	if (cookieValue === null) {
		throw new Error('Session cookie is empty');
	}

	const secret = createHash('sha256').update(options.secret, 'utf8').digest();
	const { payload } = await jwtDecrypt(cookieValue, secret, {
		issuer: 'urn:tale:headplane',
		audience: 'urn:tale:headplane',
	});

	// Safe since we encode the session directly into the JWT
	return payload as unknown as JWTSession;
}

async function destroySession(options: AuthSessionOptions) {
	const cookie = createCookie(options.cookie.name, {
		...options.cookie,
		path: __PREFIX__,
	});

	return cookie.serialize('', {
		expires: new Date(0),
	});
}

export async function createSessionStorage(options: AuthSessionOptions) {
	if (options.oidcUsersFile) {
		await migrateUserDatabase(options.oidcUsersFile, options.db);
	}

	return new Sessionizer(options);
}

async function migrateUserDatabase(path: string, db: LibSQLDatabase) {
	log.info('config', 'Migrating old user database from %s', path);
	const realPath = resolve(path);

	log.warn(
		'config',
		'oidc.user_storage_file is deprecated and will be removed in Headplane 0.7.0',
	);
	log.warn(
		'config',
		'You can ignore this warning if you do not use OIDC authentication.',
	);
	log.warn(
		'config',
		'Data will be automatically migrated to the new SQL database.',
	);
	log.warn(
		'config',
		'Refer to server.data_path to ensure this path is mounted correctly is using Docker.',
	);

	try {
		const handle = await open(realPath, 'a+');
		await handle.close();
	} catch (error) {
		log.warn('config', 'Failed to migrate old user database at %s', realPath);
		log.warn(
			'config',
			'This is not an error, but existing users will not be migrated',
		);
		log.warn('config', 'Unable to open user database file: %s', error);
		log.debug('config', 'Error details: %s', error);
		return;
	}

	log.info('config', 'Found old user database file at %s', realPath);
	log.info('config', 'Migrating user database to the new SQL database');

	let migratableUsers: {
		u: string;
		c: number;
		oo?: boolean;
	}[];

	try {
		const data = await readFile(realPath, 'utf8');
		if (data.trim().length === 0) {
			log.info('config', 'Old user database file is empty, nothing to migrate');
			log.info(
				'config',
				'You SHOULD remove oidc.user_storage_file from your config!',
			);
			await rm(realPath, { force: true });
			return;
		}

		const users = JSON.parse(data.trim()) as {
			u?: string;
			c?: number;
			oo?: boolean;
		}[];

		migratableUsers = users.filter(
			(user) => user.u !== undefined && user.c !== undefined,
		) as {
			u: string;
			c: number;
			oo?: boolean;
		}[];
	} catch (error) {
		log.warn('config', 'Error reading old user database file: %s', error);
		log.warn('config', 'Not migrating any users');
		return;
	}

	if (migratableUsers.length === 0) {
		log.info('config', 'No users found in the old database to migrate');
		return;
	}

	log.info(
		'config',
		'Migrating %d users from the old database',
		migratableUsers.length,
	);

	const updated = await db
		.insert(users)
		.values(
			migratableUsers.map((user) => ({
				id: ulid(),
				sub: user.u,
				caps: user.c,
				onboarded: user.oo ?? false,
			})),
		)
		.onConflictDoNothing({
			target: users.sub,
		})
		.returning();

	log.info('config', 'Migrated %d users successfully', updated.length);
	log.info('config', 'Removed old user database file %s', realPath);
	await rm(realPath, { force: true });
}
