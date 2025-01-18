import { createServer } from 'node:http';
import { listener } from '~server/listener';
import { initWebsocket } from '~server/ws';
import { access, constants } from 'node:fs/promises';
import log from '~server/log';

log.info('SRVX', 'Running Node.js %s', process.versions.node);

try {
	await access('./node_modules/react-router', constants.F_OK | constants.R_OK);
	log.info('SRVX', 'Found dependencies');
} catch (error) {
	log.error('SRVX', 'No dependencies found. Please run `npm install`');
	console.error(error);
	process.exit(1);
}

const server = createServer(listener);
const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

const ws = initWebsocket();
if (ws) {
	server.on('upgrade', (req, socket, head) => {
		ws.handleUpgrade(req, socket, head, (ws) => {
			ws.emit('connection', ws, req);
		});
	});
}

server.listen(Number(port), host, () => {
	log.info('SRVX', 'Running on %s:%s', host, port);
});

if (import.meta.hot) {
	import.meta.hot.on('vite:beforeFullReload', () => {
		server.close();
	});

	import.meta.hot.dispose(() => {
		server.close();
	});
}

// export const app = listener;
