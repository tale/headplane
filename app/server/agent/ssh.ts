import { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Readable, Writable } from 'node:stream';
import { decode } from 'cborg';
import { Context } from 'hono';
import { WSContext, WSEvents } from 'hono/ws';
import log from '~/utils/log';
import {
	Command,
	SSHDataCommand,
	SSHResizeCommand,
	dispatchCommand,
	dispatchWeb,
} from './dispatcher';
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

				const wsData = Buffer.isBuffer(event.data)
					? event.data
					: typeof event.data === 'string'
						? Buffer.from(event.data, 'utf8')
						: event.data instanceof Blob
							? Buffer.from(await event.data.arrayBuffer())
							: Buffer.from(event.data);

				const obj = decode(wsData) as Command;
				if (obj.op === 'ssh_data') {
					const data = obj as SSHDataCommand;
					if (data.payload.sessionId !== sessionId) {
						log.warn(
							'agent',
							'Received data for mismatched SSH session %s',
							data.payload.sessionId,
						);
						return;
					}

					const encodedFrame = await encodeSSHFrame({
						sessionId,
						channel: 0, // stdin
						payload: Buffer.from(data.payload.data),
					});

					this.sshInput.write(encodedFrame);
				}

				if (obj.op === 'ssh_resize') {
					const resize = obj as SSHResizeCommand;
					if (resize.payload.sessionId !== sessionId) {
						log.warn(
							'agent',
							'Received resize for mismatched SSH session %s',
							resize.payload.sessionId,
						);
						return;
					}

					await dispatchCommand(this.control, resize);
				}
			},

			onClose: async (_, ws) => {
				const sessionId = ws.raw;
				if (sessionId && this.connections.has(sessionId)) {
					const session = this.connections.get(sessionId);
					if (session) {
						await dispatchCommand(this.control, {
							op: 'ssh_term',
							payload: {
								sessionId,
							},
						});

						session.connected = false;
						this.connections.delete(sessionId);
					}
				}
			},

			onError: async (event, ws) => {
				const sessionId = ws.raw;
				if (sessionId && this.connections.has(sessionId)) {
					const session = this.connections.get(sessionId);
					if (session) {
						await dispatchCommand(this.control, {
							op: 'ssh_term',
							payload: {
								sessionId,
							},
						});

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
					frame: frame.payload,
				},
			});
		});
	}
}
