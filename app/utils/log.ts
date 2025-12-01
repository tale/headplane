// MARK: Side-Effects
// This module contains a side-effect because everything running here
// is static and logger is later modified in `app/server/index.ts` to
// disable debug logging if the `HEADPLANE_DEBUG_LOG` specifies as such.

const levels = ['info', 'warn', 'error', 'debug'] as const;
type Category = 'server' | 'config' | 'agent' | 'api' | 'auth';

export interface Logger
	extends Record<
		(typeof levels)[number],
		(category: Category, message: string, ...args: unknown[]) => void
	> {
	debugEnabled: boolean;
}

const logLevels = getLogLevels();
export default {
	debugEnabled: logLevels.includes('debug'),
	...Object.fromEntries(
		logLevels.map((level) => [
			level,
			(category: Category, message: string, ...args: unknown[]) => {
				const date = new Date().toISOString();
				console.log(
					`${date} [${category}] ${level.toUpperCase()}: ${message}`,
					...args,
				);
			},
		]),
	),
} as Logger;

function getLogLevels() {
	const debugLog = process.env.HEADPLANE_DEBUG_LOG;
	if (debugLog == null) {
		return ['info', 'warn', 'error'];
	}

	const normalized = debugLog.trim().toLowerCase();
	const truthyValues = ['1', 'true', 'yes', 'on'];
	if (!truthyValues.includes(normalized)) {
		return ['info', 'warn', 'error'];
	}

	return ['info', 'warn', 'error', 'debug'];
}
