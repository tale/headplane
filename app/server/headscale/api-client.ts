import { readFile } from 'node:fs/promises';
import { Agent, Dispatcher, request } from 'undici';
import log from '~/utils/log';
import ResponseError from './api-error';

export async function createApiClient(base: string, certPath?: string) {
	if (!certPath) {
		return new ApiClient(new Agent(), base);
	}

	try {
		log.debug('config', 'Loading certificate from %s', certPath);
		const data = await readFile(certPath, 'utf8');

		log.info('config', 'Using certificate from %s', certPath);
		return new ApiClient(new Agent({ connect: { ca: data.trim() } }), base);
	} catch (error) {
		log.error('config', 'Failed to load Headscale TLS cert: %s', error);
		log.debug('config', 'Error Details: %o', error);
		return new ApiClient(new Agent(), base);
	}
}

export class ApiClient {
	private agent: Agent;
	private base: string;

	constructor(agent: Agent, base: string) {
		this.agent = agent;
		this.base = base;
	}

	private async defaultFetch(
		url: string,
		options?: Partial<Dispatcher.RequestOptions>,
	) {
		const method = options?.method ?? 'GET';
		log.debug('api', '%s %s', method, url);

		return await request(new URL(url, this.base), {
			dispatcher: this.agent,
			headers: {
				...options?.headers,
				Accept: 'application/json',
				'User-Agent': `Headplane/${__VERSION__}`,
			},
			body: options?.body,
			method,
		});
	}

	async healthcheck() {
		try {
			const res = await this.defaultFetch('/health');
			return res.statusCode === 200;
		} catch (error) {
			log.debug('api', 'Healthcheck failed %o', error);
			return false;
		}
	}

	async get<T = unknown>(url: string, key: string) {
		const res = await this.defaultFetch(`/api/${url}`, {
			headers: {
				Authorization: `Bearer ${key}`,
			},
		});

		if (res.statusCode >= 400) {
			log.debug('api', 'GET %s failed with status %d', url, res.statusCode);
			throw new ResponseError(res.statusCode, await res.body.text());
		}

		return res.body.json() as Promise<T>;
	}

	async post<T = unknown>(url: string, key: string, body?: unknown) {
		const res = await this.defaultFetch(`/api/${url}`, {
			method: 'POST',
			body: body ? JSON.stringify(body) : undefined,
			headers: {
				Authorization: `Bearer ${key}`,
			},
		});

		if (res.statusCode >= 400) {
			log.debug('api', 'POST %s failed with status %d', url, res.statusCode);
			throw new ResponseError(res.statusCode, await res.body.text());
		}

		return res.body.json() as Promise<T>;
	}

	async put<T = unknown>(url: string, key: string, body?: unknown) {
		const res = await this.defaultFetch(`/api/${url}`, {
			method: 'PUT',
			body: body ? JSON.stringify(body) : undefined,
			headers: {
				Authorization: `Bearer ${key}`,
			},
		});

		if (res.statusCode >= 400) {
			log.debug('api', 'PUT %s failed with status %d', url, res.statusCode);
			throw new ResponseError(res.statusCode, await res.body.text());
		}

		return res.body.json() as Promise<T>;
	}

	async delete<T = unknown>(url: string, key: string) {
		const res = await this.defaultFetch(`/api/${url}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${key}`,
			},
		});

		if (res.statusCode >= 400) {
			log.debug('api', 'DELETE %s failed with status %d', url, res.statusCode);
			throw new ResponseError(res.statusCode, await res.body.text());
		}

		return res.body.json() as Promise<T>;
	}
}
