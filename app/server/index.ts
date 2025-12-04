import { join } from 'node:path';
import { exit, versions } from 'node:process';
import { createHonoServer } from 'react-router-hono-server/node';
import log from '~/utils/log';
import { loadIntegration } from './config/integration';
import { loadConfig } from './config/load';
import { createDbClient } from './db/client.server';
import { createHeadscaleInterface } from './headscale/api';
import { loadHeadscaleConfig } from './headscale/config-loader';
import { createHeadplaneAgent } from './hp-agent';
import { createSessionStorage } from './web/sessions';

declare global {
	const __PREFIX__: string;
	const __VERSION__: string;
}

// MARK: Side-Effects
// This module contains a side-effect because everything running here
// exists for the lifetime of the process, making it appropriate.
log.info('server', 'Running Node.js %s', versions.node);
let config: HeadplaneConfig;

try {
	config = await loadConfig();
} catch (error) {
	if (error instanceof ConfigError) {
		log.error('server', 'Unable to load configuration: %s', error.message);
	}

	exit(1);
}

const db = await createDbClient(join(config.server.data_path, 'hp_persist.db'));
const agents = await createHeadplaneAgent(
	config.integration?.agent,
	config.headscale.url,
	db,
);

const hsApi = await createHeadscaleInterface(
	config.headscale.url,
	config.headscale.tls_cert_path,
);

// We also use this file to load anything needed by the react router code.
// These are usually per-request things that we need access to, like the
// helper that can issue and revoke cookies.
export type LoadContext = typeof appLoadContext;

import 'react-router';
import { HeadplaneConfig } from './config/config-schema';
import { ConfigError } from './config/error';
import { createOidcConnector } from './web/oidc-connector';

declare module 'react-router' {
	interface AppLoadContext extends LoadContext {}
}

const appLoadContext = {
	config,
	hs: await loadHeadscaleConfig(
		config.headscale.config_path,
		config.headscale.config_strict,
		config.headscale.dns_records_path,
	),

	// TODO: Better cookie options in config
	sessions: await createSessionStorage({
		secret: config.server.cookie_secret,
		db,
		oidcUsersFile: config.oidc?.user_storage_file,
		cookie: {
			name: '_hp_auth',
			secure: config.server.cookie_secure,
			maxAge: config.server.cookie_max_age,
			domain: config.server.cookie_domain,
		},
	}),

	hsApi,
	agents,
	integration: await loadIntegration(config.integration),
	oidcConnector: config.oidc
		? await createOidcConnector(
				config.oidc,
				hsApi.getRuntimeClient(config.oidc.headscale_api_key),
			)
		: undefined,
	db,
};

declare module 'react-router' {
	interface AppLoadContext extends LoadContext {}
}

export default createHonoServer({
	overrideGlobalObjects: true,
	port: config.server.port,
	hostname: config.server.host,
	beforeAll: async (app) => {
		app.use(__PREFIX__, async (c) => {
			return c.redirect(`${__PREFIX__}/`);
		});
	},
	serveStaticOptions: {
		publicAssets: {
			// This is part of our monkey-patch for react-router-hono-server
			// To see the first part, go to the patches/ directory.
			rewriteRequestPath: (path) => path.replace(`${__PREFIX__}`, ''),
		},
		clientAssets: {
			// This is part of our monkey-patch for react-router-hono-server
			// To see the first part, go to the patches/ directory.
			rewriteRequestPath: (path) => path.replace(`${__PREFIX__}`, ''),
		},
	},

	// Only log in development mode
	defaultLogger: import.meta.env.DEV,
	getLoadContext() {
		// TODO: This is the place where we can handle reverse proxy translation
		// This is better than doing it in the OIDC client, since we can do it
		// for all requests, not just OIDC ones.
		return appLoadContext;
	},

	listeningListener(info) {
		log.info('server', 'Running on %s:%s', info.address, info.port);
	},
});

process.on('SIGINT', () => {
	log.info('server', 'Received SIGINT, shutting down...');
	process.exit(0);
});

process.on('SIGTERM', () => {
	log.info('server', 'Received SIGTERM, shutting down...');
	process.exit(0);
});
