import WebSocket, { WebSocketServer } from 'ws'
import log from '~server/log'

const server = new WebSocketServer({ noServer: true });
export function initWebsocket() {
	const key = process.env.LOCAL_AGENT_AUTHKEY;
	if (!key) {
		return;
	}

	log.info('CACH', 'Initializing agent WebSocket');
	server.on('connection', (ws, req) => {
		const auth = req.headers['authorization'];
		if (auth !== `Bearer ${key}`) {
			log.warn('CACH', 'Invalid agent WebSocket connection');
			ws.close(1008, 'ERR_INVALID_AUTH');
			return;
		}


		const nodeID = req.headers['x-headplane-ts-node-id'];
		if (!nodeID) {
			log.warn('CACH', 'Invalid agent WebSocket connection');
			ws.close(1008, 'ERR_INVALID_NODE_ID');
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
			log.error('CACH', 'Closing agent WebSocket connection');
			log.error('CACH', 'Agent WebSocket error: %s', error);
			ws.close(1011, 'ERR_INTERNAL_ERROR');
		})
	});

	return server;
}

export function appContext() {
	return {
		ws: server,
		wsAuthKey: process.env.LOCAL_AGENT_AUTHKEY,
	}
}
