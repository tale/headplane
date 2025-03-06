import { LoaderFunctionArgs } from 'react-router';
import type { AppContext } from '~server/context/app';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<AppContext>) {
	if (!context?.agentData) {
		return new Response(JSON.stringify({ error: 'Agent data unavailable' }), {
			status: 400,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	const qp = new URLSearchParams(request.url.split('?')[1]);
	const nodeIds = qp.get('node_ids')?.split(',');
	if (!nodeIds) {
		return new Response(JSON.stringify({ error: 'No node IDs provided' }), {
			status: 400,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	const entries = context.agentData.toJSON();
	const missing = nodeIds.filter((nodeID) => !entries[nodeID]);
	if (missing.length > 0) {
		await context.hp_agentRequest(missing);
	}

	return new Response(JSON.stringify(context.agentData), {
		headers: {
			'Content-Type': 'application/json',
		},
	});
}
