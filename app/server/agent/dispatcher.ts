import type { Writable } from 'node:stream';
import { encode } from 'cborg';
import { WSContext } from 'hono/ws';
import { ChannelType } from './encoder';

export interface Command {
	op: string;
	payload: unknown;
}

export interface SSHConnectCommand extends Command {
	op: 'ssh_conn';
	payload: {
		sessionId: string;
		username: string;
		hostname: string;
		port: number;
	};
}

export interface SSHCloseCommand extends Command {
	op: 'ssh_term';
	payload: {
		sessionId: string;
	};
}

export interface SSHResizeCommand extends Command {
	op: 'ssh_resize';
	payload: {
		sessionId: string;
		width: number;
		height: number;
	};
}

export interface SSHDataCommand extends Command {
	op: 'ssh_data';
	payload: {
		sessionId: string;
		data: Uint8Array;
	};
}

type AgentCommand = SSHConnectCommand | SSHCloseCommand | SSHResizeCommand;

export async function dispatchCommand(
	dispatcher: Writable,
	command: AgentCommand,
) {
	return new Promise<void>((resolve, reject) => {
		const encodedCommand = Buffer.concat([encode(command), Buffer.from('\n')]);
		dispatcher.write(encodedCommand, (err) => {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

export interface SSHConnectData extends Command {
	op: 'ssh_conn_successful';
	payload: {
		sessionId: string;
	};
}

export interface SSHConnectFailedData extends Command {
	op: 'ssh_conn_failed';
	payload: {
		reason: string;
	};
}

export interface SSHFrameData extends Command {
	op: 'ssh_frame';
	payload: {
		channel: ChannelType;
		frame: Buffer;
	};
}

type WebData = SSHConnectData | SSHConnectFailedData | SSHFrameData;

export function dispatchWeb<T>(dispatcher: WSContext<T>, data: WebData) {
	return dispatcher.send(encode(data));
}
