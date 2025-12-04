import { createInterface } from 'node:readline';
import tc from 'testcontainers';
import hashes from '~/openapi-operation-hashes.json';

export type Version = keyof typeof hashes;

export interface TailscaleNodeEnv {
	container: tc.StartedTestContainer;
	authCode: string;
	nodeName: string;
}

export async function startTailscaleNode(
	version: Version,
	headscalePort: number,
): Promise<TailscaleNodeEnv> {
	let resolveAuthCode!: (code: string) => void;
	let rejectAuthCode!: (err: Error) => void;
	let authCodeResolved = false;

	const authCodePromise = new Promise<string>((resolve, reject) => {
		resolveAuthCode = resolve;
		rejectAuthCode = reject;
	});

	const nodeName = `test-node-${version.replace(/\./g, '-')}`;
	const prefix = `http://localhost:8080/register/`;
	const container = await new tc.GenericContainer('tailscale/tailscale:latest')
		.withNetworkMode('host')
		.withEnvironment({
			TS_STATE_DIR: '/tailscale-state',
			TS_EXTRA_ARGS: [
				`--login-server=http://localhost:${headscalePort}`,
				`--hostname=${nodeName}`,
				'--accept-dns=false',
				'--accept-routes=false',
			].join(' '),
		})
		.withLogConsumer((stream) => {
			const rl = createInterface({ input: stream });

			rl.on('line', (line: string) => {
				if (authCodeResolved) return;
				const idx = line.indexOf(prefix);
				if (idx === -1) return;

				const after = line.slice(idx + prefix.length).trim();
				if (!after) return;

				const token = after.split(/\s+/)[0];
				if (!token) return;

				authCodeResolved = true;
				resolveAuthCode(token);
				rl.close();
			});

			rl.on('close', () => {
				if (!authCodeResolved) {
					rejectAuthCode(
						new Error(
							'Tailscale container log stream closed before auth code was found',
						),
					);
				}
			});
		})
		.withWaitStrategy(tc.Wait.forLogMessage(prefix).withStartupTimeout(30_000))
		.start();

	const authCode = await Promise.race<string>([
		authCodePromise,
		new Promise((_, reject) =>
			setTimeout(
				() =>
					reject(
						new Error(`Timed out waiting for Tailscale auth URL on ${prefix}`),
					),
				25_000,
			),
		),
	]);

	return { container, authCode, nodeName };
}
