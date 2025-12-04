import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import tc from 'testcontainers';

export interface HeadscaleEnv {
	container: tc.StartedTestContainer;
	apiUrl: string;
	apiKey: string;
}

const cwd = fileURLToPath(import.meta.url);
const config = join(cwd, '..', 'config.yaml');

export async function startHeadscale(version: string): Promise<HeadscaleEnv> {
	const container = await new tc.GenericContainer(
		`headscale/headscale:${version}`,
	)
		.withExposedPorts(8080)
		.withWaitStrategy(
			tc.Wait.forHttp('/health', 8080)
				.withStartupTimeout(30_000)
				.forStatusCode(200),
		)
		.withCopyFilesToContainer([
			{
				source: config,
				target: '/etc/headscale/config.yaml',
			},
		])
		.withCommand(['serve'])
		.start();

	const host = container.getHost();
	const port = container.getMappedPort(8080);
	const apiUrl = `http://${host}:${port}`;

	const exec = await container.exec([
		'headscale',
		'apikeys',
		'create',
		'-o',
		'json',
	]);

	if (exec.exitCode !== 0) {
		throw new Error(`headscale apikeys create failed:\n${exec.stderr}`);
	}

	const apiKey = JSON.parse(exec.stdout.toString());
	return { container, apiUrl, apiKey };
}
