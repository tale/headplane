import { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Readable, Writable } from 'node:stream';
import { Context } from 'hono';
import { WSContext, WSEvents } from 'hono/ws';
import log from '~/utils/log';
import { dispatchCommand } from './dispatcher';

interface SSHConnection {
	username: string;
	hostname: string;
	port: number;
}

interface SSHSession {
	connectionDetails: SSHConnection;
	connected: boolean;
	sessionId: string;
	ws: WSContext;
}

export function createSSHMultiplexer(proc: ChildProcess): SSHMultiplexer {
	return new SSHMultiplexer(proc);
}

export class SSHMultiplexer {
	private connections: Map<string, SSHSession>;
	private child: ChildProcess;

	constructor(proc: ChildProcess) {
		this.connections = new Map();
		this.child = proc;

		this.handleStdout();
	}

	// TODO: Determine if we want to allow multiple connections for the same
	// target or attempt to reuse the existing connection (sounds stupid)
	private async connect(conn: SSHConnection, ws: WSContext<string>) {
		const sessionId = randomUUID();
		const session: SSHSession = {
			connectionDetails: conn,
			connected: true,
			sessionId,
			ws,
		};

		log.info('agent', 'Dispatching SSH connection for %s', sessionId);
		await dispatchCommand(this.child.stdin, {
			op: 'ssh_conn',
			payload: {
				sessionId,
				...conn,
			},
		});

		this.connections.set(sessionId, session);
		return sessionId;
	}

	websocketHandler(c: Context): WSEvents<string> {
		return {
			onOpen: async (_, ws) => {
				const { username, hostname, port } = c.req.query();
				if (!username || !hostname || !port) {
					ws.close(1008, 'Missing connection parameters');
					return;
				}

				const conn: SSHConnection = {
					username,
					hostname,
					port: Number.parseInt(port, 10),
				};

				try {
					const sessionId = await this.connect(conn, ws);
					ws.raw = sessionId;
					ws.send(JSON.stringify({ status: 'connected', sessionId }));
				} catch (error) {
					ws.close(1011, `Connection failed: ${error.message}`);
				}
			},

			onMessage: async (event, ws) => {
				const sessionId = ws.raw;
				if (!sessionId || !this.connections.has(sessionId)) {
					ws.close(1008, 'Invalid session ID');
					return;
				}

				const session = this.connections.get(sessionId);
				if (!session || !session.connected) {
					ws.close(1008, 'Session not connected');
					return;
				}

				const encodedFrame = this.encodeFrame(sessionId, event.data);
				this.child.stdio[3]?.write(encodedFrame);
			},

			onClose: (_, ws) => {
				const sessionId = ws.raw;
				if (sessionId && this.connections.has(sessionId)) {
					const session = this.connections.get(sessionId);
					if (session) {
						session.connected = false;
						this.connections.delete(sessionId);
					}
				}
			},

			onError: (event, ws) => {
				const sessionId = ws.raw;
				if (sessionId && this.connections.has(sessionId)) {
					const session = this.connections.get(sessionId);
					if (session) {
						session.connected = false;
						this.connections.delete(sessionId);
					}
				}

				log.error('agent', 'SSH WebSocket Error with %s', sessionId);
				console.log(event);
			},
		};
	}

	private encodeFrame(id: string, data: string | Buffer): Buffer {
		const sid = Buffer.from(id, 'utf8');
		const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');

		// FIX: include +4 for the payload length
		const frame = Buffer.alloc(1 + sid.length + 4 + payload.length);
		frame.writeUint8(sid.length, 0); // 1 byte for sid length
		sid.copy(frame, 1); // SID
		frame.writeUint32BE(payload.length, 1 + sid.length); // 4 bytes for payload length
		payload.copy(frame, 1 + sid.length + 4); // Payload

		return frame;
	}

	private decodeFrame(frame: Buffer): { id: string; data: Buffer } | undefined {
		if (frame.length < 5) return;

		const sidLength = frame.readUint8(0);
		if (frame.length < 1 + sidLength + 4) return;

		const id = frame.slice(1, 1 + sidLength).toString('utf8');
		const payloadLength = frame.readUint32BE(1 + sidLength);
		if (frame.length < 1 + sidLength + 4 + payloadLength) return;

		const data = frame.slice(
			1 + sidLength + 4,
			1 + sidLength + 4 + payloadLength,
		);

		return { id, data };
	}

	private handleStdout() {
		const stdout = this.child.stdio[4];
		if (!stdout) {
			return;
		}

		stdout.on('data', (bytes) => {
			console.log(Buffer.from(bytes).toString('utf8'));
			const decoded = this.decodeFrame(bytes);
			if (!decoded) {
				return;
			}

			const { id, data } = decoded;
			console.log(id, data);
			const session = this.connections.get(id);
			if (!session || !session.connected) {
				log.warn('agent', 'Received data for disconnected session %s', id);
				return;
			}

			session.ws.send(data);
		});
	}
}
