import hashes from '~/openapi-operation-hashes.json';
import {
	createHeadscaleInterface,
	type HeadscaleApiInterface,
} from '~/server/headscale/api';
import { type HeadscaleEnv, startHeadscale } from './start-headscale';

export type Version = keyof typeof hashes;
export const HS_VERSIONS = Object.keys(hashes) as Version[];

interface VersionStateEntry {
	env: HeadscaleEnv;
	bootstrap: HeadscaleApiInterface;
}

const versionState = new Map<Version, VersionStateEntry>();
async function ensureVersion(version: Version) {
	if (versionState.has(version)) {
		return versionState.get(version)!;
	}

	const env = await startHeadscale(version);
	const bootstrap = await createHeadscaleInterface(env.apiUrl);

	const entry = { env, bootstrap };
	versionState.set(version, entry);
	return entry;
}

export async function getBootstrapClient(version: Version) {
	const { bootstrap } = await ensureVersion(version);
	return bootstrap;
}

export async function getRuntimeClient(version: Version) {
	const { env, bootstrap } = await ensureVersion(version);
	return bootstrap.getRuntimeClient(env.apiKey);
}

export async function stopAllVersions() {
	for (const { env } of versionState.values()) {
		await env.container.stop({
			remove: true,
			removeVolumes: true,
		});
	}

	versionState.clear();
}
