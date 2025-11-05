import { defineApiEndpoints } from '../factory';

export interface PolicyEndpoints {
	/**
	 * Retrieves the current ACL policy from the Headscale instance.
	 *
	 * @returns The ACL policy as a string and the date it was last updated.
	 */
	getPolicy(): Promise<{ policy: string; updatedAt: Date | null }>;

	/**
	 * Sets the ACL policy for the Headscale instance.
	 *
	 * @param policy The ACL policy as a string.
	 * @returns The updated ACL policy as a string and the date it was last updated.
	 */
	setPolicy(policy: string): Promise<{ policy: string; updatedAt: Date }>;
}

export default defineApiEndpoints<PolicyEndpoints>((client, apiKey) => ({
	getPolicy: async () => {
		const { policy, updatedAt } = await client.apiFetch<{
			policy: string;
			updatedAt: string;
		}>('GET', 'v1/policy', apiKey);

		return {
			policy,
			updatedAt: updatedAt !== null ? new Date(updatedAt) : null,
		};
	},

	setPolicy: async (policy) => {
		const { policy: newPolicy, updatedAt } = await client.apiFetch<{
			policy: string;
			updatedAt: string;
		}>('PUT', 'v1/policy', apiKey, { policy });

		return { policy: newPolicy, updatedAt: new Date(updatedAt) };
	},
}));
