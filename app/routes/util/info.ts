import { versions } from 'node:process';
import { data } from 'react-router';
import type { Route } from './+types/info';

export async function loader({ request, context }: Route.LoaderArgs) {
	if (context.config.server.info_secret == null) {
		throw data(
			{
				status: 'Forbidden',
			},
			403,
		);
	}

	const bearer = request.headers.get('Authorization') ?? '';
	if (!bearer.startsWith('Bearer ')) {
		throw data(
			{
				status: 'Unauthorized',
			},
			401,
		);
	}

	const token = bearer.slice('Bearer '.length).trim();
	if (token !== context.config.server.info_secret) {
		throw data(
			{
				status: 'Forbidden',
			},
			403,
		);
	}

	// Use a fake API key for healthcheck
	const api = context.hsApi.getRuntimeClient('fake-api-key');
	const healthy = await api.isHealthy();

	const body = {
		status: healthy ? 'OK' : 'ERROR',
		headplane_version: __VERSION__,
		headscale_canonical_version: healthy ? context.hsApi.apiVersion : 'unknown',
		internal_versions: {
			node: versions.node,
			v8: versions.v8,
			uv: versions.uv,
			zlib: versions.zlib,
			openssl: versions.openssl,
			libc: versions.libc,
		},
	};

	return new Response(JSON.stringify(body), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}
