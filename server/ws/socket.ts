import WebSocket, { WebSocketServer } from 'ws';
import log from '~server/utils/log';

const server = new WebSocketServer({ noServer: true });
export function initWebsocket(authKey: string) {
	if (authKey.length === 0) {
		return;
	}

	log.info('SRVX', 'Starting a WebSocket server for agent connections');
	server.on('connection', (ws, req) => {
		const tailnetID = req.headers['x-headplane-tailnet-id'];
		if (!tailnetID) {
			log.warn(
				'SRVX',
				'Rejecting an agent WebSocket connection without a tailnet ID',
			);
			ws.close(1008, 'ERR_INVALID_TAILNET_ID');
			return;
		}

		if (req.headers.authorization !== `Bearer ${authKey}`) {
			log.warn('SRVX', 'Rejecting an unauthorized WebSocket connection');
			if (req.socket.remoteAddress) {
				log.warn('SRVX', 'Agent source IP: %s', req.socket.remoteAddress);
			}

			ws.close(1008, 'ERR_UNAUTHORIZED');
			return;
		}

		const pinger = setInterval(() => {
			if (ws.readyState !== WebSocket.OPEN) {
				clearInterval(pinger);
				return;
			}

			ws.ping();
		}, 30000);

		ws.on('close', () => {
			clearInterval(pinger);
		});

		ws.on('error', (error) => {
			clearInterval(pinger);
			log.error('SRVX', 'Agent WebSocket error: %s', error);
			log.debug('SRVX', 'Error details: %o', error);
			log.error('SRVX', 'Closing agent WebSocket connection');
			ws.close(1011, 'ERR_INTERNAL_ERROR');
		});
	});

	return server;
}

export function hp_getAgents() {
	return server.clients;
}
