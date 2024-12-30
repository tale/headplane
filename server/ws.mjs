// The Websocket server is wholly responsible for ingesting messages from
// Headplane agent instances (hopefully not more than 1 is running lol)
import { WebSocketServer } from 'ws'
import { log } from './utils.mjs'

const wss = new WebSocketServer({ noServer: true })
wss.on('connection', (ws, req) => {
	// On connection the agent will send its NodeID via Headers
	// We store this for later use to validate and show on the UI
	const nodeID = req.headers['x-headplane-ts-node-id']
	if (!nodeID) {
		ws.close(1008, 'ERR_NO_HP_TS_NODE_ID')
		return
	}
})

export async function registerWss(server) {
	log('SRVX', 'INFO', 'Registering Websocket Server')
	server.on('upgrade', (request, socket, head) => {
		wss.handleUpgrade(request, socket, head, ws => {
			wss.emit('connection', ws, request)
		})
	})
}

export function getWss() {
	return wss
}
