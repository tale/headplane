import { decryptCookie } from '$lib/crypto';
import type { Handle } from '@sveltejs/kit';
export const handle: Handle = async ({ event, resolve }) => {
	const cookie = event.cookies.get('hs_api_key');
	if (cookie) {
		const key = await decryptCookie(cookie);
		event.locals.apiKey = key;
	}

	const response = await resolve(event);
	return response;
};
