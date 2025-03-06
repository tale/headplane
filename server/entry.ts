import { constants, access } from 'node:fs/promises';
import { createServer } from 'node:http';
import { hp_getConfig, hp_loadConfig } from '~server/context/loader';
import { listener } from '~server/listener';
import log from '~server/utils/log';
import { hp_loadAgentCache } from '~server/ws/data';
import { initWebsocket } from '~server/ws/socket';

log.info('SRVX', 'Running Node.js %s', process.versions.node);

try {
	await access('./node_modules/react-router', constants.F_OK | constants.R_OK);
	log.info('SRVX', 'Found dependencies');
} catch (error) {
	log.error('SRVX', 'No dependencies found. Please run `npm install`');
	console.error(error);
	process.exit(1);
}

await hp_loadConfig();
const server = createServer(listener);

const context = hp_getConfig();
const ws = initWebsocket(context.server.agent.authkey);
if (ws) {
	await hp_loadAgentCache(
		context.server.agent.ttl,
		context.server.agent.cache_path,
	);

	server.on('upgrade', (req, socket, head) => {
		ws.handleUpgrade(req, socket, head, (ws) => {
			ws.emit('connection', ws, req);
		});
	});
}

server.listen(context.server.port, context.server.host, () => {
	log.info(
		'SRVX',
		'Running on %s:%s',
		context.server.host,
		context.server.port,
	);
});

if (import.meta.hot) {
	import.meta.hot.on('vite:beforeFullReload', () => {
		server.close();
	});

	import.meta.hot.dispose(() => {
		server.close();
	});
}
