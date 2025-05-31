import { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Readable, Writable } from 'node:stream';
import { Context } from 'hono';
import { WSContext, WSEvents } from 'hono/ws';
import log from '~/utils/log';
import { dispatchCommand, dispatchWeb } from './dispatcher';
import { decodeSSHFrame, encodeSSHFrame } from './encoder';

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

interface FrameDecodeSuccess {
	id: string;
	data: Buffer;
}

interface FrameDecodeFailure {
	id: undefined;
	data: undefined;
}

export function createSSHMultiplexer(proc: ChildProcess): SSHMultiplexer {
	const control = proc.stdin;
	const sshInput = proc.stdio[3];
	const sshOutput = proc.stdio[4];

	if (!control || !sshInput || !sshOutput) {
		throw new Error('Invalid SSH multiplexer process: missing stdio streams');
	}

	return new SSHMultiplexer(
		control,
		sshInput as Writable,
		sshOutput as Readable,
	);
}

export class SSHMultiplexer {
	private connections: Map<string, SSHSession>;
	private control: Writable;
	private sshInput: Writable;
	private sshOutput: Readable;

	constructor(control: Writable, sshInput: Writable, sshOutput: Readable) {
		this.connections = new Map();
		this.control = control;
		this.sshInput = sshInput;
		this.sshOutput = sshOutput;
		this.configureStdout();
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

		log.debug('agent', 'Dispatching SSH connection for %s', sessionId);
		await dispatchCommand(this.control, {
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
					dispatchWeb(ws, {
						op: 'ssh_conn_successful',
						payload: { sessionId },
					});
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : 'Unknown error';

					dispatchWeb(ws, {
						op: 'ssh_conn_failed',
						payload: {
							reason: errorMessage,
						},
					});

					ws.close(1011, 'Connection failed');
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

				const encodedFrame = await encodeSSHFrame({
					sessionId,
					channel: 0, // stdin
					payload: event.data,
				});

				this.sshInput.write(encodedFrame);
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
				log.debug('agent', 'Error details: %o', event);
			},
		};
	}

	private configureStdout() {
		this.sshOutput.on('data', (bytes) => {
			const frame = decodeSSHFrame(bytes);
			if (!frame) {
				return;
			}

			const session = this.connections.get(frame.sessionId);
			if (!session || !session.connected) {
				log.warn(
					'agent',
					'Received data for invalid SSH session %s',
					frame.sessionId,
				);
				return;
			}

			dispatchWeb(session.ws, {
				op: 'ssh_frame',
				payload: {
					channel: frame.channel,
					data: frame.payload,
				},
			});
		});
	}
}
