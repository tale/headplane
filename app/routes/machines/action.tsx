import type { ActionFunctionArgs } from 'react-router';
import { del, post } from '~/utils/headscale';
import { getSession } from '~/utils/sessions';
import { send } from '~/utils/res';
import log from '~/utils/log';

export async function menuAction(request: ActionFunctionArgs['request']) {
	const session = await getSession(request.headers.get('Cookie'));
	if (!session.has('hsApiKey')) {
		return send(
			{ message: 'Unauthorized' },
			{
				status: 401,
			},
		);
	}

	const data = await request.formData();
	if (!data.has('_method') || !data.has('id')) {
		return send(
			{ message: 'No method or ID provided' },
			{
				status: 400,
			},
		);
	}

	const id = String(data.get('id'));
	const method = String(data.get('_method'));

	switch (method) {
		case 'delete': {
			await del(`v1/node/${id}`, session.get('hsApiKey')!);
			return { message: 'Machine removed' };
		}

		case 'expire': {
			await post(`v1/node/${id}/expire`, session.get('hsApiKey')!);
			return { message: 'Machine expired' };
		}

		case 'rename': {
			if (!data.has('name')) {
				return send(
					{ message: 'No name provided' },
					{
						status: 400,
					},
				);
			}

			const name = String(data.get('name'));

			await post(`v1/node/${id}/rename/${name}`, session.get('hsApiKey')!);
			return { message: 'Machine renamed' };
		}

		case 'routes': {
			if (!data.has('route') || !data.has('enabled')) {
				return send(
					{ message: 'No route or enabled provided' },
					{
						status: 400,
					},
				);
			}

			const route = String(data.get('route'));
			const enabled = data.get('enabled') === 'true';
			const postfix = enabled ? 'enable' : 'disable';

			await post(`v1/routes/${route}/${postfix}`, session.get('hsApiKey')!);
			return { message: 'Route updated' };
		}

		case 'exit-node': {
			if (!data.has('routes') || !data.has('enabled')) {
				return send(
					{ message: 'No route or enabled provided' },
					{
						status: 400,
					},
				);
			}

			const routes = data.get('routes')?.toString().split(',') ?? [];
			const enabled = data.get('enabled') === 'true';
			const postfix = enabled ? 'enable' : 'disable';

			await Promise.all(
				routes.map(async (route) => {
					await post(`v1/routes/${route}/${postfix}`, session.get('hsApiKey')!);
				}),
			);

			return { message: 'Exit node updated' };
		}

		case 'move': {
			if (!data.has('to')) {
				return send(
					{ message: 'No destination provided' },
					{
						status: 400,
					},
				);
			}

			const to = String(data.get('to'));

			try {
				await post(`v1/node/${id}/user?user=${to}`, session.get('hsApiKey')!);
				return { message: `Moved node ${id} to ${to}` };
			} catch {
				return send(
					{ message: `Failed to move node ${id} to ${to}` },
					{
						status: 500,
					},
				);
			}
		}

		case 'tags': {
			const tags =
				data
					.get('tags')
					?.toString()
					.split(',')
					.filter((tag) => tag.trim() !== '') ?? [];

			try {
				await post(`v1/node/${id}/tags`, session.get('hsApiKey')!, {
					tags,
				});

				return { message: 'Tags updated' };
			} catch (error) {
				log.debug('APIC', 'Failed to update tags: %s', error);
				return send(
					{ message: 'Failed to update tags' },
					{
						status: 500,
					},
				);
			}
		}

		case 'register': {
			const key = data.get('mkey')?.toString();
			const user = data.get('user')?.toString();

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
				await post(url, session.get('hsApiKey')!, {
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
