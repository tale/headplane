import { getBootstrapClient, HS_VERSIONS, stopAllVersions } from './env';

export async function setup() {
	for (const version of HS_VERSIONS) {
		await getBootstrapClient(version);
	}
}

export async function teardown() {
	await stopAllVersions();
}
