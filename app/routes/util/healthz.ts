import { LoaderFunctionArgs } from 'react-router';
import type { LoadContext } from '~/server';

export async function loader({ context }: LoaderFunctionArgs<LoadContext>) {
	const healthy = await context.client.healthcheck();
	return new Response(JSON.stringify({ status: healthy ? 'OK' : 'ERROR' }), {
		status: healthy ? 200 : 500,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}
