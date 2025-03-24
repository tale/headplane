import { exit } from 'node:process';
import { type } from 'arktype';
import log from '~/utils/log';

// Custom type for boolean environment variables, allowing for values like
// 1, true, yes, and on to count as a truthy value.
const booleanEnv = type('string | undefined').pipe((v) => {
	return ['1', 'true', 'yes', 'on'].includes(v?.toLowerCase() ?? '');
});

export const envVariables = {
	debugLog: 'HEADPLANE_DEBUG_LOG',
	envOverrides: 'HEADPLANE_LOAD_ENV_OVERRIDES',
	configPath: 'HEADPLANE_CONFIG_PATH',
} as const;

export function configureLogger(env: string | undefined) {
	const result = booleanEnv(env);
	if (result instanceof type.errors) {
		log.error(
			'config',
			'HEADPLANE_DEBUG_LOG value is invalid: %s',
			result.summary,
		);
		log.info('config', 'Using a default value: false');
		log.debug = () => {}; // Disable debug logging if the value is invalid
		log.debugEnabled = false;
		return;
	}

	if (result === false) {
		log.debug = () => {}; // Disable debug logging if the value is false
		log.debugEnabled = false;
		return;
	}

	log.debug('config', 'Debug logging has been enabled');
	log.debug('config', 'It is recommended this be disabled in production');
}

export interface EnvOverrides {
	loadEnv: boolean;
	path: string;
}

export function configureConfig(overrides: {
	loadEnv: string | undefined;
	path: string | undefined;
}): EnvOverrides {
	const loadResult = booleanEnv(overrides.loadEnv);
	if (loadResult instanceof type.errors) {
		log.error(
			'config',
			'HEADPLANE_LOAD_ENV_OVERRIDES value is invalid: %s',
			loadResult.summary,
		);

		exit(1);
	}

	const pathResult = type('string | undefined')(overrides.path);
	if (pathResult instanceof type.errors) {
		log.error(
			'config',
			'HEADPLANE_CONFIG_PATH value is invalid: %s',
			pathResult.summary,
		);

		exit(1);
	}

	return {
		loadEnv: loadResult,
		path: pathResult ?? '/etc/headplane/config.yaml',
	};
}
