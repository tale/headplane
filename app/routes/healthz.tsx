import { loadContext } from '~/utils/config/headplane'
import { HeadscaleError, pull } from '~/utils/headscale'
import log from '~/utils/log'

export async function loader() {
	const context = await loadContext()

	try {
		// Doesn't matter, we just need a 401
		await pull('v1/', 'wrongkey')
	} catch (e) {
		if (!(e instanceof HeadscaleError)) {
			log.debug('Healthz', 'Headscale is not reachable')
			return new Response('Headscale is not reachable', {
				status: 500,
				headers: {
					'Content-Type': 'text/plain',
				},
			})
		}
	}

	return new Response('OK', {
		status: 200,
		headers: {
			'Content-Type': 'text/plain',
		},
	})
}
