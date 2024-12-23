export function log(topic, level, message) {
	const date = new Date().toISOString()
	console.log(`${date} (${level}) [${topic}] ${message}`)
}
