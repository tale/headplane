import { LoaderFunctionArgs } from 'react-router';
import { hp_getSingleton, hp_getSingletonUnsafe } from '~server/context/global';

export async function loader({ request }: LoaderFunctionArgs) {
	const data = hp_getSingletonUnsafe('ws_agent_data');

	if (!data) {
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

	const entries = data.toJSON();
	const missing = nodeIds.filter((nodeID) => !entries[nodeID]);
	if (missing.length > 0) {
		const requestCall = hp_getSingleton('ws_fetch_data');
		requestCall(missing);
	}

	return new Response(JSON.stringify(data), {
		headers: {
			'Content-Type': 'application/json',
		},
	});
}
