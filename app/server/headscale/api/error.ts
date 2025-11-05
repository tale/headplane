import { data } from 'react-router';
import { errors } from 'undici';

// Represents an error that occurred during a response
// Thrown when status codes are >= 400
export default class ResponseError extends Error {
	status: number;
	response: string;
	responseObject?: Record<string, unknown>;

	constructor(status: number, response: string, requestUrl: string) {
		super(`${requestUrl}: status ${status} - ${response}`);
		this.name = 'ResponseError';
		this.status = status;
		this.response = response;

		try {
			// Try to parse the response as JSON to get a response object
			this.responseObject = JSON.parse(response);
		} catch {}
	}
}

function isNodeNetworkError(error: unknown): error is NodeJS.ErrnoException {
	if (typeof error !== 'object' || error === null) {
		return false;
	}

	const keys = Object.keys(error as Record<string, unknown>);
	return keys.includes('code') && keys.includes('errno');
}

export function friendlyError(givenError: unknown) {
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
