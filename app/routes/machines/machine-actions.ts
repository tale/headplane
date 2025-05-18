import { type ActionFunctionArgs, data, redirect } from 'react-router';
import type { LoadContext } from '~/server';
import { Capabilities } from '~/server/web/roles';
import { Machine } from '~/types';

export async function machineAction({
	request,
	context,
}: ActionFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
	const check = await context.sessions.check(
		request,
		Capabilities.write_machines,
	);

	const formData = await request.formData();
	const apiKey = session.get('api_key')!;

	const action = formData.get('action_id')?.toString();
	if (!action) {
		throw data('Missing `action_id` in the form data.', {
			status: 400,
		});
	}

	// Fast track register since it doesn't require an existing machine
	if (action === 'register') {
		if (!check) {
			throw data('You do not have permission to manage machines', {
				status: 403,
			});
		}

		return registerMachine(formData, apiKey, context);
	}

	// Check if the user has permission to manage this machine
	const nodeId = formData.get('node_id')?.toString();
	if (!nodeId) {
		throw data('Missing `node_id` in the form data.', {
			status: 400,
		});
	}

	const { nodes } = await context.client.get<{ nodes: Machine[] }>(
		'v1/node',
		apiKey,
	);

	const node = nodes.find((node) => node.id === nodeId);
	if (!node) {
		throw data(`Machine with ID ${nodeId} not found`, {
			status: 404,
		});
	}

	if (
		node.user.providerId?.split('/').pop() !== session.get('user')!.subject &&
		!check
	) {
		throw data('You do not have permission to act on this machine', {
			status: 403,
		});
	}

	switch (action) {
		case 'rename': {
			return renameMachine(formData, apiKey, nodeId, context);
		}

		case 'delete': {
			return deleteMachine(apiKey, nodeId, context);
		}

		case 'expire': {
			return expireMachine(apiKey, nodeId, context);
		}

		case 'update_tags': {
			return updateTags(formData, apiKey, nodeId, context);
		}

		case 'update_routes': {
			return updateRoutes(formData, apiKey, nodeId, context);
		}

		case 'reassign': {
			return reassignMachine(formData, apiKey, nodeId, context);
		}

		default:
			throw data('Invalid action', {
				status: 400,
			});
	}
}

async function registerMachine(
	formData: FormData,
	apiKey: string,
	context: LoadContext,
) {
	const registrationKey = formData.get('register_key')?.toString();
	if (!registrationKey) {
		throw data('Missing `register_key` in the form data.', {
			status: 400,
		});
	}

	const user = formData.get('user')?.toString();
	if (!user) {
		throw data('Missing `user` in the form data.', {
			status: 400,
		});
	}

	const qp = new URLSearchParams();
	qp.append('user', user);
	qp.append('key', registrationKey);
	const url = `v1/node/register?${qp.toString()}`;
	const { node } = await context.client.post<{ node: Machine }>(url, apiKey, {
		user,
		key: registrationKey,
	});

	return redirect(`/machines/${node.id}`);
}

async function renameMachine(
	formData: FormData,
	apiKey: string,
	nodeId: string,
	context: LoadContext,
) {
	const newName = formData.get('name')?.toString();
	if (!newName) {
		throw data('Missing `name` in the form data.', {
			status: 400,
		});
	}

	const name = String(formData.get('name'));
	await context.client.post(`v1/node/${nodeId}/rename/${name}`, apiKey);
	return { message: 'Machine renamed' };
}

async function deleteMachine(
	apiKey: string,
	nodeId: string,
	context: LoadContext,
) {
	await context.client.delete(`v1/node/${nodeId}`, apiKey);
	return redirect('/machines');
}

async function expireMachine(
	apiKey: string,
	nodeId: string,
	context: LoadContext,
) {
	await context.client.post(`v1/node/${nodeId}/expire`, apiKey);
	return { message: 'Machine expired' };
}

async function updateTags(
	formData: FormData,
	apiKey: string,
	nodeId: string,
	context: LoadContext,
) {
	const tags = formData.get('tags')?.toString().split(',') ?? [];
	if (tags.length === 0) {
		throw data('Missing `tags` in the form data.', {
			status: 400,
		});
	}

	await context.client.post(`v1/node/${nodeId}/tags`, apiKey, {
		tags: tags.map((tag) => tag.trim()).filter((tag) => tag !== ''),
	});

	return { message: 'Tags updated' };
}

async function updateRoutes(
	formData: FormData,
	apiKey: string,
	nodeId: string,
	context: LoadContext,
) {
	const { node } = await context.client.get<{ node: Machine }>(
		`v1/node/${nodeId}`,
		apiKey,
	);

	const newApproved = node.approvedRoutes;
	const routes = formData.get('routes')?.toString();
	if (!routes) {
		throw data('Missing `routes` in the form data.', {
			status: 400,
		});
	}

	const allRoutes = routes.split(',').map((route) => route.trim());
	if (allRoutes.length === 0) {
		throw data('No routes provided to update', {
			status: 400,
		});
	}

	const enabled = formData.get('enabled')?.toString();
	if (enabled === undefined) {
		throw data('Missing `enabled` in the form data.', {
			status: 400,
		});
	}

	if (enabled === 'true') {
		for (const route of allRoutes) {
			// If already approved, skip, otherwise add to approved
			if (newApproved.includes(route)) {
				continue;
			}

			newApproved.push(route);
		}
	} else {
		for (const route of allRoutes) {
			// If not approved, skip, otherwise remove from approved
			if (!newApproved.includes(route)) {
				continue;
			}

			const index = newApproved.indexOf(route);
			if (index > -1) {
				newApproved.splice(index, 1);
			}
		}
	}

	await context.client.post(`v1/node/${nodeId}/approve_routes`, apiKey, {
		routes: newApproved,
	});

	return { message: 'Routes updated' };
}

async function reassignMachine(
	formData: FormData,
	apiKey: string,
	nodeId: string,
	context: LoadContext,
) {
	const user = formData.get('user_id')?.toString();
	if (!user) {
		throw data('Missing `user_id` in the form data.', {
			status: 400,
		});
	}

	await context.client.post(`v1/node/${nodeId}/user`, apiKey, {
		user,
	});

	return { message: 'Machine reassigned' };
}
