import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dereference } from '@readme/openapi-parser';
import type { OpenAPIV2 } from 'openapi-types';
import { data } from 'react-router';
import { Agent, type Dispatcher, request } from 'undici';
import log from '~/utils/log';
import endpointSets, { RuntimeApiClient } from './endpoints';
import { undiciToFriendlyError } from './error';
import { HeadscaleAPIError } from './error-client';
import { detectApiVersion, isAtLeast, type Version } from './version';

/**
 * A low-level composed interface for interacting with the Headscale API.
 * This interface provides direct access to the underlying Undici agent
 * and methods for making API requests.
 *
 * It is also responsible for handling OpenAPI spec polling and hashing to
 * determine the implementations of API methods when requested for use.
 */
export interface HeadscaleApiInterface {
	/**
	 * The underlying Undici agent used for making requests.
	 */
	undiciAgent: Agent;

	/**
	 * The base URL of the Headscale API.
	 */
	baseUrl: string;

	/**
	 * The OpenAPI hashes retrieved from the Headscale instance at runtime.
	 * This is used to determine which implementations of API methods to use.
	 */
	openapiHashes: Record<string, string> | null;

	/**
	 * The detected API version of the connected Headscale instance.
	 */
	apiVersion: Version;

	/**
	 * Retrieves a runtime API client for the given API key.
	 *
	 * @param apiKey The API key to use for authentication.
	 * @returns A `RuntimeApiClient` instance for interacting with the API.
	 */
	getRuntimeClient(apiKey: string): RuntimeApiClient;

	/**
	 * A set of helper methods made available to API method implementations.
	 * The idea is to make interacting with the API easier by providing
	 * common functionality that can be reused across multiple methods.
	 */
	clientHelpers: {
		/**
		 * Checks if the connected Headscale instance's API version
		 * is at least the specified version.
		 *
		 * @param version The version to check against.
		 * @returns `true` if the API version is at least the specified version, `false` otherwise.
		 */
		isAtleast(version: Version): boolean;

		/**
		 * Makes a raw fetch request to the Headscale API via the Undici agent.
		 * This method is used internally by API method implementations
		 * to make requests to the Headscale API.
		 *
		 * @param path The API path to request.
		 * @param options Optional request options.
		 * @returns A promise that resolves to the response data.
		 */
		rawFetch(
			path: string,
			options?: Partial<Dispatcher.RequestOptions>,
		): Promise<Dispatcher.ResponseData>;

		/**
		 * Makes a typed API fetch request to the Headscale API.
		 * This method is used internally by API method implementations
		 * to make requests to the Headscale API and parse the response.
		 *
		 * @param method The HTTP method to use.
		 * @param apiPath The API path to request.
		 * @param apiKey The API key to use for authentication.
		 * @param bodyOrQuery Optional body or query parameters.
		 * @returns A promise that resolves to the typed response data.
		 */
		apiFetch<T>(
			method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
			apiPath: `v1/${string}`,
			apiKey: string,
			bodyOrQuery?: Record<string, unknown>,
		): Promise<T>;
	};
}

/**
 * Creates a new Headscale API client interface.
 *
 * @param baseUrl The base URL of the Headscale API.
 * @param certPath Optional path to a custom TLS certificate for secure connections.
 * @returns A promise that resolves to a `HeadscaleApiClient` instance.
 */
export async function createHeadscaleInterface(
	baseUrl: string,
	certPath?: string,
): Promise<HeadscaleApiInterface> {
	const undiciAgent = await createUndiciAgent(certPath);
	let openapiHashes: Record<string, string> | null = null;
	let apiVersion: Version;

	const rawFetch = async (
		url: string,
		options?: Partial<Dispatcher.RequestOptions>,
	): Promise<Dispatcher.ResponseData> => {
		const method = options?.method ?? 'GET';
		log.debug('api', '%s %s', method, url);

		try {
			const res = await request(new URL(url, baseUrl), {
				dispatcher: undiciAgent,
				headers: {
					...options?.headers,
					Accept: 'application/json',
					'User-Agent': `Headplane/${__VERSION__}`,
				},

				body: options?.body,
				method,
			});

			return res;
		} catch (error) {
			const errorBody = undiciToFriendlyError(error, `${method} ${url}`);
			throw data(errorBody, {
				status: 502,
				statusText: 'Bad Gateway',
			});
		}
	};

	const apiFetch = async <T>(
		method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
		apiPath: `v1/${string}`,
		apiKey: string,
		bodyOrQuery?: Record<string, unknown>,
	): Promise<T> => {
		let url = `/api/${apiPath}`;
		const options: Partial<Dispatcher.RequestOptions> = {
			method: method,
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		};

		if (bodyOrQuery) {
			if (method === 'GET' || method === 'DELETE') {
				// Filter out undefined values

				const params = new URLSearchParams();
				for (const [key, value] of Object.entries(bodyOrQuery)) {
					if (value !== undefined) {
						params.append(key, String(value));
					}
				}

				if ([...params.keys()].length > 0) {
					url += `?${params.toString()}`;
				}
			} else {
				options.body = JSON.stringify(bodyOrQuery);
				options.headers = {
					...options.headers,
					'Content-Type': 'application/json',
				};
			}
		}

		const res = await rawFetch(url, options);
		if (res.statusCode >= 400) {
			log.debug(
				'api',
				'%s %s failed with status %d',
				method,
				apiPath,
				res.statusCode,
			);

			const rawData = await res.body.text();
			const jsonData = (() => {
				try {
					return JSON.parse(rawData) as Record<string, unknown>;
				} catch {
					return null;
				}
			})();

			throw data(
				{
					requestUrl: `${method} ${apiPath}`,
					statusCode: res.statusCode,
					rawData,
					data: jsonData,
				} satisfies HeadscaleAPIError,
				{
					status: 502,
					statusText: 'Bad Gateway',
				},
			);
		}

		return res.body.json() as Promise<T>;
	};

	/**
	 * Polls the OpenAPI spec endpoint and generates operation hashes.
	 * This is used to determine which implementations of API methods to use.
	 *
	 * @returns A promise that resolves to the OpenAPI operation hashes.
	 */
	async function fetchAndHashOpenapi(): Promise<Record<string, string> | null> {
		try {
			const res = await rawFetch('/swagger/v1/openapiv2.json');
			if (res.statusCode !== 200) {
				log.error('api', 'Failed to fetch OpenAPI spec: %d', res.statusCode);
				return null;
			}

			const body = await res.body.json();
			const spec = await dereference(body as OpenAPIV2.Document);
			const hashes = generateSpecHashes(spec);
			log.debug(
				'api',
				'OpenAPI hashes updated (%d endpoints)',
				Object.keys(hashes).length,
			);
			return hashes;
		} catch (err) {
			log.warn('api', 'Error during OpenAPI polling: %o', err);
			return null;
		}
	}

	const isAtleast = (version: Version): boolean => {
		return isAtLeast(apiVersion, version);
	};

	openapiHashes = await fetchAndHashOpenapi();
	apiVersion = detectApiVersion(openapiHashes);

	setInterval(async () => {
		const hashes = await fetchAndHashOpenapi();
		if (hashes) {
			openapiHashes = hashes;
			apiVersion = detectApiVersion(openapiHashes);
		}
	}, 60_000); // every 60 seconds

	return {
		undiciAgent,
		baseUrl,
		openapiHashes,
		apiVersion,
		getRuntimeClient: (apiKey: string) =>
			endpointSets(
				{
					rawFetch,
					apiFetch,
					isAtleast,
				},
				apiKey,
			),
		clientHelpers: {
			rawFetch,
			apiFetch,
			isAtleast,
		},
	};
}

/**
 * Creates a new Undici agent for making HTTP requests.
 *
 * @param certPath Optional path to a custom TLS certificate for secure connections.
 * @returns A promise that resolves to an `Agent` instance.
 */
async function createUndiciAgent(certPath?: string): Promise<Agent> {
	if (!certPath) {
		return new Agent();
	}

	try {
		log.debug('config', 'Loading certificate from %s', certPath);
		const data = await readFile(certPath, 'utf8');

		log.info('config', 'Using certificate from %s', certPath);
		return new Agent({ connect: { ca: data.trim() } });
	} catch (error) {
		log.error('config', 'Failed to load Headscale TLS cert: %s', error);
		log.debug('config', 'Error Details: %o', error);
		return new Agent();
	}
}

function generateSpecHashes(spec: OpenAPIV2.Document) {
	const hashes: Record<string, string> = {};
	const seen = new Set<string>();

	for (const [path, item] of Object.entries(spec.paths)) {
		for (const [method, operation] of Object.entries(item)) {
			if (typeof operation !== 'object') {
				continue;
			}

			const { parameters, responses } = operation as OpenAPIV2.OperationObject;
			const raw = JSON.stringify(
				{
					path,
					method: method.toUpperCase(),
					parameters,
					responses,
				},
				Object.keys({ path, method, parameters, responses }).sort(),
			);

			const hash = createHash('md5').update(raw).digest('hex').slice(0, 16);
			const final = seen.has(hash) ? `${hash}_${seen.size}` : hash;
			seen.add(final);
			hashes[`${method.toUpperCase()} ${path}`] = final;
		}
	}

	return hashes;
}
