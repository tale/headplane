import type { Writable } from 'node:stream';
import { encode } from 'cborg';
import { WSContext } from 'hono/ws';
import { ChannelType } from './encoder';

interface Command {
	op: string;
	payload: unknown;
}

interface SSHConnectCommand extends Command {
	op: 'ssh_conn';
	payload: {
		sessionId: string;
		username: string;
		hostname: string;
		port: number;
	};
}

type AgentCommand = SSHConnectCommand;

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

interface SSHConnectData extends Command {
	op: 'ssh_conn_successful';
	payload: {
		sessionId: string;
	};
}

interface SSHConnectFailedData extends Command {
	op: 'ssh_conn_failed';
	payload: {
		reason: string;
	};
}

interface SSHFrameData extends Command {
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
