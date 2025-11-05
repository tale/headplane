import {
	composeEndpoints,
	defineApiEndpoints,
	type ExtractApiEndpoints,
	type UnionToIntersection,
} from '../factory';
import type { HeadscaleApiInterface } from '../index';
import apiKeyEndpoints from './api-keys';
import nodeEndpoints from './nodes';
import policyEndpoints from './policy';
import preAuthKeyEndpoints from './pre-auth-keys';
import userEndpoints from './users';

interface HealthcheckEndpoint {
	/**
	 * Checks if the Headscale instance is healthy.
	 *
	 * @returns A boolean indicating if the instance is healthy.
	 */
	isHealthy(): Promise<boolean>;
}

const healthcheckEndpoint = defineApiEndpoints<HealthcheckEndpoint>(
	(client, apiKey) => ({
		isHealthy: async () => {
			try {
				const res = await client.rawFetch('/health', {
					method: 'GET',
					headers: {
						// This doesn't really matter
						Authorization: `Bearer ${apiKey}`,
					},
				});

				return res.statusCode === 200;
			} catch {
				return false;
			}
		},
	}),
);

/**
 * A constant list of all endpoint groups.
 * Add new endpoint groups here.
 */
export const endpointSets = [
	apiKeyEndpoints,
	healthcheckEndpoint,
	nodeEndpoints,
	policyEndpoints,
	preAuthKeyEndpoints,
	userEndpoints,
] as const;

/**
 * All of the available API methods when interacting with Headscale's API.
 * We have wrapped each operation with nice methods and parameters to make it
 * easier to do integration testing by spinning up an actual Headscale instance
 * and calling these methods against it.
 *
 * We also have the benefit of supporting multiple Headscale versions by
 * passing in different internal implementations based on the OpenAPI spec.
 */
export type RuntimeApiClient = UnionToIntersection<
	ExtractApiEndpoints<(typeof endpointSets)[number]>
>;

/**
 * Composes all endpoint groups into a single runtime API client.
 *
 * @param client - The client helpers for making API requests.
 * @param apiKey - The API key for authentication.
 * @returns A fully composed runtime API client.
 */
export default (
	client: HeadscaleApiInterface['clientHelpers'],
	apiKey: string,
) => composeEndpoints(endpointSets, client, apiKey);
