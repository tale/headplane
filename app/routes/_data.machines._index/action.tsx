/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ActionFunctionArgs, json } from '@remix-run/node'

import { del, post } from '~/utils/headscale'
import { getSession } from '~/utils/sessions'

export async function menuAction(request: ActionFunctionArgs['request']) {
	const session = await getSession(request.headers.get('Cookie'))
	if (!session.has('hsApiKey')) {
		return json({ message: 'Unauthorized' }, {
			status: 401,
		})
	}

	const data = await request.formData()
	if (!data.has('_method') || !data.has('id')) {
		return json({ message: 'No method or ID provided' }, {
			status: 400,
		})
	}

	const id = String(data.get('id'))
	const method = String(data.get('_method'))

	switch (method) {
		case 'delete': {
			await del(`v1/node/${id}`, session.get('hsApiKey')!)
			return json({ message: 'Machine removed' })
		}

		case 'expire': {
			await post(`v1/node/${id}/expire`, session.get('hsApiKey')!)
			return json({ message: 'Machine expired' })
		}

		case 'rename': {
			if (!data.has('name')) {
				return json({ message: 'No name provided' }, {
					status: 400,
				})
			}

			const name = String(data.get('name'))

			await post(`v1/node/${id}/rename/${name}`, session.get('hsApiKey')!)
			return json({ message: 'Machine renamed' })
		}

		case 'routes': {
			if (!data.has('route') || !data.has('enabled')) {
				return json({ message: 'No route or enabled provided' }, {
					status: 400,
				})
			}

			const route = String(data.get('route'))
			const enabled = data.get('enabled') === 'true'
			const postfix = enabled ? 'enable' : 'disable'

			await post(`v1/routes/${route}/${postfix}`, session.get('hsApiKey')!)
			return json({ message: 'Route updated' })
		}

		case 'move': {
			if (!data.has('to')) {
				return json({ message: 'No destination provided' }, {
					status: 400,
				})
			}

			const to = String(data.get('to'))

			try {
				await post(`v1/node/${id}/user?user=${to}`, session.get('hsApiKey')!)
				return json({ message: `Moved node ${id} to ${to}` })
			} catch {
				return json({ message: `Failed to move node ${id} to ${to}` }, {
					status: 500,
				})
			}
		}

		default: {
			return json({ message: 'Invalid method' }, {
				status: 400,
			})
		}
	}
}
