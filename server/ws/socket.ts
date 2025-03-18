import WebSocket, { WebSocketServer } from 'ws';
import { hp_setSingleton } from '~server/context/global';
import log from '~server/utils/log';
import { hp_agentRequest } from './data';

export function initWebsocket(server: WebSocketServer, authKey: string) {
	log.info('SRVX', 'Starting a WebSocket server for agent connections');
	const agents = new Map<string, WebSocket>();
	hp_setSingleton('ws_agents', agents);
	hp_setSingleton('ws_fetch_data', hp_agentRequest);

	server.on('connection', (ws, req) => {
		const tailnetID = req.headers['x-headplane-tailnet-id'];
		if (!tailnetID || typeof tailnetID !== 'string') {
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

		agents.set(tailnetID, ws);
		const pinger = setInterval(() => {
			if (ws.readyState !== WebSocket.OPEN) {
				clearInterval(pinger);
				return;
			}

			ws.ping();
		}, 30000);

		ws.on('close', () => {
			clearInterval(pinger);
			agents.delete(tailnetID);
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
