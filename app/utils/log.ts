export default {
	info: (category: string, message: string, ...args: unknown[]) => {
		defaultLog('INFO', category, message, ...args)
	},

	warn: (category: string, message: string, ...args: unknown[]) => {
		defaultLog('WARN', category, message, ...args)
	},

	error: (category: string, message: string, ...args: unknown[]) => {
		defaultLog('ERRO', category, message, ...args)
	},

	debug: (category: string, message: string, ...args: unknown[]) => {
		if (process.env.DEBUG === 'true') {
			defaultLog('DEBG', category, message, ...args)
		}
	}
}

function defaultLog(
	level: string,
	category: string,
	message: string,
	...args: unknown[]
) {
	const date = new Date().toISOString()
	console.log(`${date} (${level}) [${category}] ${message}`, ...args)
}
