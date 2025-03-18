import { request } from 'undici';
import { hp_getConfig, hp_getSingleton } from '~server/context/global';
import log from '~server/utils/log';

export class HeadscaleError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = 'HeadscaleError';
		this.status = status;
	}
}

export class FatalError extends Error {
	constructor() {
		super(
			'The Headscale server is not accessible or the supplied API key is invalid',
		);
		this.name = 'FatalError';
	}
}

export async function healthcheck() {
	log.debug('APIC', 'GET /health');
	const health = new URL('health', hp_getConfig().headscale.url);
	const response = await request(health.toString(), {
		dispatcher: hp_getSingleton('api_agent'),
		headers: {
			Accept: 'application/json',
		},
	});

	// Intentionally not catching
	return response.statusCode === 200;
}

export async function pull<T>(url: string, key: string) {
	if (!key || key === 'undefined' || key.length === 0) {
		throw new Error('Missing API key, could this be a cookie setting issue?');
	}

	const prefix = hp_getConfig().headscale.url;
	log.debug('APIC', 'GET %s', `${prefix}/api/${url}`);
	const response = await request(`${prefix}/api/${url}`, {
		dispatcher: hp_getSingleton('api_agent'),
		headers: {
			Authorization: `Bearer ${key}`,
		},
	});

	if (response.statusCode >= 400) {
		log.debug(
			'APIC',
			'GET %s failed with status %d',
			`${prefix}/api/${url}`,
			response.statusCode,
		);
		throw new HeadscaleError(await response.body.text(), response.statusCode);
	}

	return response.body.json() as Promise<T>;
}

export async function post<T>(url: string, key: string, body?: unknown) {
	if (!key || key === 'undefined' || key.length === 0) {
		throw new Error('Missing API key, could this be a cookie setting issue?');
	}

	const prefix = hp_getConfig().headscale.url;
	log.debug('APIC', 'POST %s', `${prefix}/api/${url}`);
	const response = await request(`${prefix}/api/${url}`, {
		dispatcher: hp_getSingleton('api_agent'),
		method: 'POST',
		body: body ? JSON.stringify(body) : undefined,
		headers: {
			Authorization: `Bearer ${key}`,
		},
	});

	if (response.statusCode >= 400) {
		log.debug(
			'APIC',
			'POST %s failed with status %d',
			`${prefix}/api/${url}`,
			response.statusCode,
		);
		throw new HeadscaleError(await response.body.text(), response.statusCode);
	}

	return response.body.json() as Promise<T>;
}

export async function put<T>(url: string, key: string, body?: unknown) {
	if (!key || key === 'undefined' || key.length === 0) {
		throw new Error('Missing API key, could this be a cookie setting issue?');
	}

	const prefix = hp_getConfig().headscale.url;
	log.debug('APIC', 'PUT %s', `${prefix}/api/${url}`);
	const response = await request(`${prefix}/api/${url}`, {
		dispatcher: hp_getSingleton('api_agent'),
		method: 'PUT',
		body: body ? JSON.stringify(body) : undefined,
		headers: {
			Authorization: `Bearer ${key}`,
		},
	});

	if (response.statusCode >= 400) {
		log.debug(
			'APIC',
			'PUT %s failed with status %d',
			`${prefix}/api/${url}`,
			response.statusCode,
		);
		throw new HeadscaleError(await response.body.text(), response.statusCode);
	}

	return response.body.json() as Promise<T>;
}

export async function del<T>(url: string, key: string) {
	if (!key || key === 'undefined' || key.length === 0) {
		throw new Error('Missing API key, could this be a cookie setting issue?');
	}

	const prefix = hp_getConfig().headscale.url;
	log.debug('APIC', 'DELETE %s', `${prefix}/api/${url}`);
	const response = await request(`${prefix}/api/${url}`, {
		dispatcher: hp_getSingleton('api_agent'),
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${key}`,
		},
	});

	if (response.statusCode >= 400) {
		log.debug(
			'APIC',
			'DELETE %s failed with status %d',
			`${prefix}/api/${url}`,
			response.statusCode,
		);
		throw new HeadscaleError(await response.body.text(), response.statusCode);
	}

	return response.body.json() as Promise<T>;
}
