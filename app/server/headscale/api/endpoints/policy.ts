import { defineApiEndpoints } from '../factory';

export type ParsePolicyResult =
	| {
			success: true;
			tests: Array<{
				src: string;
				proto?: string;
				accept?: string[];
				deny?: string[];
			}>;
	  }
	| { success: false; error: string };

/**
 * Parse HuJSON policy to extract embedded tests.
 * Strips comments and trailing commas before parsing.
 * Returns a result object that distinguishes between syntax errors and missing tests.
 */
export function parsePolicy(policyData: string): ParsePolicyResult {
	try {
		const cleanJson = policyData
			.replace(/\/\/.*$/gm, '') // Remove single-line comments
			.replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
			.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
		const parsed = JSON.parse(cleanJson);
		return {
			success: true,
			tests: Array.isArray(parsed.tests) ? parsed.tests : [],
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown parsing error';
		return { success: false, error: `Syntax Error: ${message}` };
	}
}

/**
 * Parse HuJSON policy to extract embedded tests.
 * Strips comments and trailing commas before parsing.
 * @deprecated Use parsePolicy() for better error handling
 */
export function extractTestsFromPolicy(
	policyData: string,
): Array<{ src: string; proto?: string; accept?: string[]; deny?: string[] }> {
	const result = parsePolicy(policyData);
	return result.success ? result.tests : [];
}

/**
 * Represents a single ACL test case.
 */
export interface ACLTest {
	src: string;
	proto?: string;
	accept?: string[];
	deny?: string[];
}

/**
 * Result of running a single ACL test.
 */
export interface ACLTestResult {
	src: string;
	passed: boolean;
	errors?: string[];
	acceptOk?: string[];
	acceptFail?: string[];
	denyOk?: string[];
	denyFail?: string[];
	// Original test definition for display
	testIndex: number;
	proto?: string;
	accept?: string[];
	deny?: string[];
}

/**
 * Response from the ACL test endpoint.
 */
export interface TestACLResponse {
	allPassed: boolean;
	results: ACLTestResult[];
}

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

	/**
	 * Tests ACL rules against a policy.
	 * If tests array is empty, runs embedded tests from the policy.
	 *
	 * @param policy The ACL policy to test against.
	 * @param tests Optional array of test cases. If empty, runs embedded tests.
	 * @returns Test results with pass/fail status for each test case.
	 */
	testPolicy(policy: string, tests?: ACLTest[]): Promise<TestACLResponse>;
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

	testPolicy: async (policy, tests) => {
		// If tests provided, use them directly
		let testsToSend = tests && tests.length > 0 ? tests : undefined;

		// Otherwise try to extract embedded tests from the policy
		if (!testsToSend) {
			const parseResult = parsePolicy(policy);
			if (!parseResult.success) {
				throw new Error(parseResult.error);
			}
			testsToSend = parseResult.tests;
		}

		if (testsToSend.length === 0) {
			throw new Error(
				'No tests found in the policy. Add a "tests" array to your ACL.',
			);
		}

		const body = { policy, tests: testsToSend };

		const response = await client.apiFetch<{
			all_passed: boolean;
			results: Array<{
				src: string;
				passed: boolean;
				errors: string[];
				accept_ok: string[];
				accept_fail: string[];
				deny_ok: string[];
				deny_fail: string[];
			}>;
		}>('POST', 'v1/policy/test', apiKey, body);

		return {
			allPassed: response.all_passed,
			results: response.results.map((r, index) => ({
				src: r.src,
				passed: r.passed,
				errors: r.errors,
				acceptOk: r.accept_ok,
				acceptFail: r.accept_fail,
				denyOk: r.deny_ok,
				denyFail: r.deny_fail,
				// Include original test definition for display
				testIndex: index,
				proto: testsToSend[index]?.proto,
				accept: testsToSend[index]?.accept,
				deny: testsToSend[index]?.deny,
			})),
		};
	},
}));
