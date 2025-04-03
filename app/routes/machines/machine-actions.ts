import type { ActionFunctionArgs } from 'react-router';
import type { LoadContext } from '~/server';
import { Capabilities } from '~/server/web/roles';
import { Machine } from '~/types';
import log from '~/utils/log';
import { data400, data403, data404, send } from '~/utils/res';

// TODO: Clean this up like dns-actions and user-actions
export async function machineAction({
	request,
	context,
}: ActionFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
	const check = await context.sessions.check(
		request,
		Capabilities.write_machines,
	);

	const apiKey = session.get('api_key')!;
	const formData = await request.formData();

	// TODO: Rename this to 'action_id' and 'node_id'
	const action = formData.get('_method')?.toString();
	const nodeId = formData.get('id')?.toString();
	if (!action || !nodeId) {
		return data400('Missing required parameters: _method and id');
	}

	const { nodes } = await context.client.get<{ nodes: Machine[] }>(
		'v1/node',
		apiKey,
	);

	const node = nodes.find((node) => node.id === nodeId);
	if (!node) {
		return data404(`Node with ID ${nodeId} not found`);
	}

	const subject = session.get('user')!.subject;
	if (node.user.providerId?.split('/').pop() !== subject) {
		if (!check) {
			return data403('You do not have permission to act on this machine');
		}
	}

	// TODO: Split up into methods
	switch (action) {
		case 'delete': {
			await context.client.delete(`v1/node/${nodeId}`, session.get('api_key')!);
			return { message: 'Machine removed' };
		}

		case 'expire': {
			await context.client.post(
				`v1/node/${nodeId}/expire`,
				session.get('api_key')!,
			);
			return { message: 'Machine expired' };
		}

		case 'rename': {
			if (!formData.has('name')) {
				return send(
					{ message: 'No name provided' },
					{
						status: 400,
					},
				);
			}

			const name = String(formData.get('name'));
			await context.client.post(
				`v1/node/${nodeId}/rename/${name}`,
				session.get('api_key')!,
			);
			return { message: 'Machine renamed' };
		}

		case 'routes': {
			if (!formData.has('route') || !formData.has('enabled')) {
				return send(
					{ message: 'No route or enabled provided' },
					{
						status: 400,
					},
				);
			}

			const route = String(formData.get('route'));
			const enabled = formData.get('enabled') === 'true';
			const postfix = enabled ? 'enable' : 'disable';

			await context.client.post(
				`v1/routes/${route}/${postfix}`,
				session.get('api_key')!,
			);
			return { message: 'Route updated' };
		}

		case 'exit-node': {
			if (!formData.has('routes') || !formData.has('enabled')) {
				return send(
					{ message: 'No route or enabled provided' },
					{
						status: 400,
					},
				);
			}

			const routes = formData.get('routes')?.toString().split(',') ?? [];
			const enabled = formData.get('enabled') === 'true';
			const postfix = enabled ? 'enable' : 'disable';

			await Promise.all(
				routes.map(async (route) => {
					await context.client.post(
						`v1/routes/${route}/${postfix}`,
						session.get('api_key')!,
					);
				}),
			);

			return { message: 'Exit node updated' };
		}

		case 'move': {
			if (!formData.has('to')) {
				return send(
					{ message: 'No destination provided' },
					{
						status: 400,
					},
				);
			}

			const to = String(formData.get('to'));

			try {
				await context.client.post(
					`v1/node/${nodeId}/user`,
					session.get('api_key')!,
					{
						user: to,
					},
				);

				return { message: `Moved node ${nodeId} to ${to}` };
			} catch (error) {
				console.error(error);
				return send(
					{ message: `Failed to move node ${nodeId} to ${to}` },
					{
						status: 500,
					},
				);
			}
		}

		case 'tags': {
			const tags =
				formData
					.get('tags')
					?.toString()
					.split(',')
					.filter((tag) => tag.trim() !== '') ?? [];

			try {
				await context.client.post(
					`v1/node/${nodeId}/tags`,
					session.get('api_key')!,
					{
						tags,
					},
				);

				return { message: 'Tags updated' };
			} catch (error) {
				log.debug('api', 'Failed to update tags: %s', error);
				return send(
					{ message: 'Failed to update tags' },
					{
						status: 500,
					},
				);
			}
		}

		case 'register': {
			const key = formData.get('mkey')?.toString();
			const user = formData.get('user')?.toString();

			if (!key) {
				return send(
					{ message: 'No machine key provided' },
					{
						status: 400,
					},
				);
			}

			if (!user) {
				return send(
					{ message: 'No user provided' },
					{
						status: 400,
					},
				);
			}

			try {
				const qp = new URLSearchParams();
				qp.append('user', user);
				qp.append('key', key);

				const url = `v1/node/register?${qp.toString()}`;
				await context.client.post(url, session.get('api_key')!, {
					user,
					key,
				});

				return {
					success: true,
					message: 'Machine registered',
				};
			} catch {
				return send(
					{
						success: false,
						message: 'Failed to register machine',
					},
					{
						status: 500,
					},
				);
			}
		}

		default: {
			return send(
				{ message: 'Invalid method' },
				{
					status: 400,
				},
			);
		}
	}
}
