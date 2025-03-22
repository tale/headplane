import { versions } from 'node:process';
import { createHonoServer } from 'react-router-hono-server/node';
import log from '~/utils/log';
import { configureConfig, configureLogger, envVariables } from './config/env';
import { loadConfig } from './config/loader';
import { createApiClient } from './headscale/api-client';
import { loadHeadscaleConfig } from './headscale/config-loader';
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
configureLogger(process.env[envVariables.debugLog]);
const config = await loadConfig(
	configureConfig({
		loadEnv: process.env[envVariables.envOverrides],
		path: process.env[envVariables.configPath],
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
	),

	// TODO: Better cookie options in config
	sessions: createSessionStorage({
		name: '_hp_session',
		maxAge: 60 * 60 * 24, // 24 hours
		secure: config.server.cookie_secure,
		secrets: [config.server.cookie_secret],
	}),

	client: await createApiClient(
		config.headscale.url,
		config.headscale.tls_cert_path,
	),

	oidc: config.oidc ? await createOidcClient(config.oidc) : undefined,
};

declare module 'react-router' {
	interface AppLoadContext extends LoadContext {}
}

export default await createHonoServer({
	useWebSocket: true,
	// overrideGlobalObjects: true,

	getLoadContext(c, { build, mode }) {
		// This is the place where we can handle reverse proxy translation
		return appLoadContext;
	},

	configure(server) {},
	listeningListener(info) {
		console.log(`Server is listening on http://localhost:${info.port}`);
	},
});
