import { defineApiEndpoints } from '../factory';

export interface PolicyEndpoints {
	/**
	 * Retrieves the current ACL policy from the Headscale instance.
	 *
	 * @returns The ACL policy as a string.
	 */
	getPolicy(): Promise<string>;

	/**
	 * Sets the ACL policy for the Headscale instance.
	 *
	 * @param policy The ACL policy as a string.
	 * @returns The expiration date of the new policy.
	 */
	setPolicy(policy: string): Promise<Date>;
}

export default defineApiEndpoints<PolicyEndpoints>((client, apiKey) => ({
	getPolicy: async () => {
		const { policy } = await client.apiFetch<{ policy: string }>(
			'GET',
			'v1/policy',
			apiKey,
		);

		return policy;
	},

	setPolicy: async (policy) => {
		const { updatedAt } = await client.apiFetch<{ updatedAt: string }>(
			'PUT',
			'v1/policy',
			apiKey,
			{ policy },
		);

		return new Date(updatedAt);
	},
}));
