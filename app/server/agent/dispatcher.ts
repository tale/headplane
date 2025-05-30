import type { Writable } from 'node:stream';
import { decode, encode } from 'cbor2';

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
			console.log('Command dispatched:', command, err);
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}
