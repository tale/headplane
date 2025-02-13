import log from '~/utils/log';
import { hp_getConfig } from '~/utils/state';

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
	const context = hp_getConfig();
	const prefix = context.headscale.url;
	log.debug('APIC', 'GET /health');

	const health = new URL('health', prefix);
	const response = await fetch(health.toString(), {
		headers: {
			Accept: 'application/json',
		},
	});

	// Intentionally not catching
	return response.status === 200;
}

export async function pull<T>(url: string, key: string) {
	if (!key || key === 'undefined' || key.length === 0) {
		throw new Error('Missing API key, could this be a cookie setting issue?');
	}

	const context = hp_getConfig();
	const prefix = context.headscale.url;

	log.debug('APIC', 'GET %s', `${prefix}/api/${url}`);
	const response = await fetch(`${prefix}/api/${url}`, {
		headers: {
			Authorization: `Bearer ${key}`,
		},
	});

	if (!response.ok) {
		log.debug(
			'APIC',
			'GET %s failed with status %d',
			`${prefix}/api/${url}`,
			response.status,
		);
		throw new HeadscaleError(await response.text(), response.status);
	}

	return response.json() as Promise<T>;
}

export async function post<T>(url: string, key: string, body?: unknown) {
	if (!key || key === 'undefined' || key.length === 0) {
		throw new Error('Missing API key, could this be a cookie setting issue?');
	}

	const context = hp_getConfig();
	const prefix = context.headscale.url;

	log.debug('APIC', 'POST %s', `${prefix}/api/${url}`);
	const response = await fetch(`${prefix}/api/${url}`, {
		method: 'POST',
		body: body ? JSON.stringify(body) : undefined,
		headers: {
			Authorization: `Bearer ${key}`,
		},
	});

	if (!response.ok) {
		log.debug(
			'APIC',
			'POST %s failed with status %d',
			`${prefix}/api/${url}`,
			response.status,
		);
		throw new HeadscaleError(await response.text(), response.status);
	}

	return response.json() as Promise<T>;
}

export async function put<T>(url: string, key: string, body?: unknown) {
	if (!key || key === 'undefined' || key.length === 0) {
		throw new Error('Missing API key, could this be a cookie setting issue?');
	}

	const context = hp_getConfig();
	const prefix = context.headscale.url;

	log.debug('APIC', 'PUT %s', `${prefix}/api/${url}`);
	const response = await fetch(`${prefix}/api/${url}`, {
		method: 'PUT',
		body: body ? JSON.stringify(body) : undefined,
		headers: {
			Authorization: `Bearer ${key}`,
		},
	});

	if (!response.ok) {
		log.debug(
			'APIC',
			'PUT %s failed with status %d',
			`${prefix}/api/${url}`,
			response.status,
		);
		throw new HeadscaleError(await response.text(), response.status);
	}

	return response.json() as Promise<T>;
}

export async function del<T>(url: string, key: string) {
	if (!key || key === 'undefined' || key.length === 0) {
		throw new Error('Missing API key, could this be a cookie setting issue?');
	}

	const context = hp_getConfig();
	const prefix = context.headscale.url;

	log.debug('APIC', 'DELETE %s', `${prefix}/api/${url}`);
	const response = await fetch(`${prefix}/api/${url}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${key}`,
		},
	});

	if (!response.ok) {
		log.debug(
			'APIC',
			'DELETE %s failed with status %d',
			`${prefix}/api/${url}`,
			response.status,
		);
		throw new HeadscaleError(await response.text(), response.status);
	}

	return response.json() as Promise<T>;
}
