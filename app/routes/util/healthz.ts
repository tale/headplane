import type { Route } from './+types/healthz';

export async function loader({ context }: Route.LoaderArgs) {
	// Use a fake API key for healthcheck
	const api = context.hsApi.getRuntimeClient('fake-api-key');
	const healthy = await api.isHealthy();

	return new Response(JSON.stringify({ status: healthy ? 'OK' : 'ERROR' }), {
		status: healthy ? 200 : 500,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}
