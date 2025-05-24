import { readFile } from 'node:fs/promises';
import { data } from 'react-router';
import { Agent, Dispatcher, request } from 'undici';
import { errors } from 'undici';
import log from '~/utils/log';
import ResponseError from './api-error';

function isNodeNetworkError(error: unknown): error is NodeJS.ErrnoException {
	const keys = Object.keys(error as Record<string, unknown>);
	return (
		typeof error === 'object' &&
		error !== null &&
		keys.includes('code') &&
		keys.includes('errno')
	);
}

function friendlyError(givenError: unknown) {
	let error: unknown = givenError;
	if (error instanceof AggregateError) {
		error = error.errors[0];
	}

	switch (true) {
		case error instanceof errors.BodyTimeoutError:
		case error instanceof errors.ConnectTimeoutError:
		case error instanceof errors.HeadersTimeoutError:
			return data('Timed out waiting for a response from the Headscale API', {
				statusText: 'Request Timeout',
				status: 408,
			});

		case error instanceof errors.SocketError:
		case error instanceof errors.SecureProxyConnectionError:
		case error instanceof errors.ClientClosedError:
		case error instanceof errors.ClientDestroyedError:
		case error instanceof errors.RequestAbortedError:
			return data('The Headscale API is not reachable', {
				statusText: 'Service Unavailable',
				status: 503,
			});

		case error instanceof errors.InvalidArgumentError:
		case error instanceof errors.InvalidReturnValueError:
		case error instanceof errors.NotSupportedError:
			return data('Unable to make a request (this is most likely a bug)', {
				statusText: 'Internal Server Error',
				status: 500,
			});

		case error instanceof errors.HeadersOverflowError:
		case error instanceof errors.RequestContentLengthMismatchError:
		case error instanceof errors.ResponseContentLengthMismatchError:
		case error instanceof errors.ResponseExceededMaxSizeError:
			return data('The Headscale API returned a malformed response', {
				statusText: 'Bad Gateway',
				status: 502,
			});

		case isNodeNetworkError(error):
			if (error.code === 'ECONNREFUSED') {
				return data('The Headscale API is not reachable', {
					statusText: 'Service Unavailable',
					status: 503,
				});
			}

			if (error.code === 'ENOTFOUND') {
				return data('The Headscale API is not reachable', {
					statusText: 'Service Unavailable',
					status: 503,
				});
			}

			if (error.code === 'EAI_AGAIN') {
				return data('The Headscale API is not reachable', {
					statusText: 'Service Unavailable',
					status: 503,
				});
			}

			if (error.code === 'ETIMEDOUT') {
				return data('Timed out waiting for a response from the Headscale API', {
					statusText: 'Request Timeout',
					status: 408,
				});
			}

			if (error.code === 'ECONNRESET') {
				return data('The Headscale API is not reachable', {
					statusText: 'Service Unavailable',
					status: 503,
				});
			}

			if (error.code === 'EPIPE') {
				return data('The Headscale API is not reachable', {
					statusText: 'Service Unavailable',
					status: 503,
				});
			}

			if (error.code === 'ENETUNREACH') {
				return data('The Headscale API is not reachable', {
					statusText: 'Service Unavailable',
					status: 503,
				});
			}

			if (error.code === 'ENETRESET') {
				return data('The Headscale API is not reachable', {
					statusText: 'Service Unavailable',
					status: 503,
				});
			}

			return data('The Headscale API is not reachable', {
				statusText: 'Service Unavailable',
				status: 503,
			});

		default:
			return data((error as Error).message ?? 'An unknown error occurred', {
				statusText: 'Internal Server Error',
				status: 500,
			});
	}
}

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

		try {
			const res = await request(new URL(url, this.base), {
				dispatcher: this.agent,
				headers: {
					...options?.headers,
					Accept: 'application/json',
					'User-Agent': `Headplane/${__VERSION__}`,
				},
				body: options?.body,
				method,
			});

			return res;
		} catch (error: unknown) {
			throw friendlyError(error);
		}
	}

	async healthcheck() {
		try {
			const res = await request(new URL('/health', this.base), {
				dispatcher: this.agent,
				headers: {
					Accept: 'application/json',
					'User-Agent': `Headplane/${__VERSION__}`,
				},
			});

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
