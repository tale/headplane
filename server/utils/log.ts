import {
	hp_getSingleton,
	hp_getSingletonUnsafe,
	hp_setSingleton,
} from '~server/context/global';

export interface Logger {
	info: (category: string, message: string, ...args: unknown[]) => void;
	warn: (category: string, message: string, ...args: unknown[]) => void;
	error: (category: string, message: string, ...args: unknown[]) => void;
	debug: (category: string, message: string, ...args: unknown[]) => void;
}

export function hp_loadLogger(debug: boolean) {
	const newLog = { ...log };
	if (debug) {
		newLog.debug = (category: string, message: string, ...args: unknown[]) => {
			defaultLog('DEBG', category, message, ...args);
		};

		newLog.info('CFGX', 'Debug logging enabled');
		newLog.info(
			'CFGX',
			'This is very verbose and should only be used for debugging purposes',
		);
		newLog.info(
			'CFGX',
			'If you run this in production, your storage COULD fill up quickly',
		);
	}

	hp_setSingleton('logger', newLog);
}

function defaultLog(
	level: string,
	category: string,
	message: string,
	...args: unknown[]
) {
	const date = new Date().toISOString();
	console.log(`${date} (${level}) [${category}] ${message}`, ...args);
}

const log = {
	info: (category: string, message: string, ...args: unknown[]) => {
		defaultLog('INFO', category, message, ...args);
	},

	warn: (category: string, message: string, ...args: unknown[]) => {
		defaultLog('WARN', category, message, ...args);
	},

	error: (category: string, message: string, ...args: unknown[]) => {
		defaultLog('ERRO', category, message, ...args);
	},

	debug: (category: string, message: string, ...args: unknown[]) => {},
};

export default hp_getSingletonUnsafe('logger') ?? log;
