import { createRequestHandler } from 'react-router'
import { access, constants } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import log from '~server/log';

export default async function() {
	const buildPath = process.env.BUILD_PATH ?? './build';
	const server = resolve(join(buildPath, 'server'));

	try {
		await access(server, constants.F_OK | constants.R_OK);
		log.info('SRVX', 'Using build directory %s', resolve(buildPath));
	} catch (error) {
		log.error('SRVX', 'No build found. Please refer to the documentation');
		log.error('SRVX', 'https://github.com/tale/headplane/blob/main/docs/integration/Native.md');
		console.error(error);
		process.exit(1);
	}

	// @vite-ignore
	const build = await import(resolve(join(server, 'index.js')));
	return createRequestHandler(build, 'production');
}
