import { loadContext } from '~/utils/config/headplane';
import { HeadscaleError, pull } from '~/utils/headscale';
import log from '~/utils/log';

export async function loader() {
	const context = await loadContext();
	const prefix = context.headscaleUrl;
	const health = new URL('health', prefix);
	log.debug('APIC', 'GET %s', health.toString());
	let healthy = false

	try {
		const res = await fetch(health.toString(), {
			headers: {
				'Accept': 'application/json',
			},
		});

		if (res.status === 200) {
			healthy = true;
		}
	} catch (e) {
		log.debug('APIC', 'GET %s failed with error %s', health.toString(), e);
	}

	return new Response(JSON.stringify({ status: healthy ? 'OK' : 'ERROR' }), {
		status: healthy ? 200 : 500,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}
