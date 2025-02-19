export function hp_loadLogger(debug: boolean) {
	if (debug) {
		log.debug = (category: string, message: string, ...args: unknown[]) => {
			defaultLog('DEBG', category, message, ...args);
		};
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

export function noContext() {
	return new Error(
		'Context is not loaded. This is most likely a configuration error with your reverse proxy.',
	);
}

export default log;
