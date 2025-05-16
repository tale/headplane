import { env, versions } from 'node:process';
import { createHonoServer } from 'react-router-hono-server/node';

import log from '~/utils/log';
import { configureConfig, configureLogger, envVariables } from './config/env';
import { loadIntegration } from './config/integration';
import { loadConfig } from './config/loader';
import { createApiClient } from './headscale/api-client';
import { loadHeadscaleConfig } from './headscale/config-loader';
import { loadAgentSocket } from './web/agent';
import { createOidcClient } from './web/oidc';
import { createSessionStorage } from './web/sessions';

declare global {
	const __PREFIX__: string;
	const __VERSION__: string;
}

// MARK: Side-Effects
// This module contains a side-effect because everything running here
// exists for the lifetime of the process, making it appropriate.
log.info('server', 'Running Node.js %s', versions.node);
configureLogger(env[envVariables.debugLog]);
const config = await loadConfig(
	configureConfig({
		loadEnv: env[envVariables.envOverrides],
		path: env[envVariables.configPath],
	}),
);

// We also use this file to load anything needed by the react router code.
// These are usually per-request things that we need access to, like the
// helper that can issue and revoke cookies.
export type LoadContext = typeof appLoadContext;
const appLoadContext = {
	config,
	hs: await loadHeadscaleConfig(
		config.headscale.config_path,
		config.headscale.config_strict,
		config.headscale.dns_records_path,
	),

	// TODO: Better cookie options in config
	sessions: await createSessionStorage(
		{
			name: '_hp_session',
			maxAge: 60 * 60 * 24, // 24 hours
			secure: config.server.cookie_secure,
			secrets: [config.server.cookie_secret],
		},
		config.oidc?.user_storage_file,
	),

	client: await createApiClient(
		config.headscale.url,
		config.headscale.tls_cert_path,
	),

	agents: await loadAgentSocket(
		config.integration?.agent,
		config.headscale.url,
	),
	integration: await loadIntegration(config.integration),
	oidc: config.oidc ? await createOidcClient(config.oidc) : undefined,
};

declare module 'react-router' {
	interface AppLoadContext extends LoadContext {}
}

export default createHonoServer({
	overrideGlobalObjects: true,
	port: config.server.port,
	hostname: config.server.host,

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
