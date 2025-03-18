import { healthcheck } from '~/utils/headscale';
import log from '~server/utils/log';

export async function loader() {
	let healthy = false;
	try {
		healthy = await healthcheck();
	} catch (error) {
		log.debug('APIC', 'Healthcheck failed %o', error);
	}

	return new Response(JSON.stringify({ status: healthy ? 'OK' : 'ERROR' }), {
		status: healthy ? 200 : 500,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}
