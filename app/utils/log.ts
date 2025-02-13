export function hp_loadLogger(debug: boolean) {
	if (debug) {
		log.debug = (category: string, message: string, ...args: unknown[]) => {
			defaultLog('DEBG', category, message, ...args);
		};

		log.info('CFGX', 'Debug logging enabled');
		log.info(
			'CFGX',
			'This is very verbose and should only be used for debugging purposes',
		);
		log.info(
			'CFGX',
			'If you run this in production, your storage WILL fill up quickly',
		);
	}
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

	// Default to a no-op until the logger is initialized
	debug: (category: string, message: string, ...args: unknown[]) => {},
};

function defaultLog(
	level: string,
	category: string,
	message: string,
	...args: unknown[]
) {
	const date = new Date().toISOString();
	console.log(`${date} (${level}) [${category}] ${message}`, ...args);
}

export default log;
