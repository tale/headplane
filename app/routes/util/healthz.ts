import { loadContext } from '~/utils/config/headplane';
import { HeadscaleError, pull } from '~/utils/headscale';
import { data } from 'react-router';
import log from '~/utils/log';

export async function loader() {
	const context = await loadContext();

	try {
		// Doesn't matter, we just need a 401
		await pull('v1/', 'wrongkey');
	} catch (e) {
		if (!(e instanceof HeadscaleError)) {
			log.debug('Healthz', 'Headscale is not reachable');
			return data(
				{
					status: 'NOT OK',
					error: e.message,
				},
				{ status: 500 },
			);
		}
	}

	return data({ status: 'OK' });
}
