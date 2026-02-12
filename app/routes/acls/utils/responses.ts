import { data } from 'react-router';
import type { TestACLResponse } from '~/server/headscale/api/endpoints/policy';

export type TestPolicyResponse = {
	success: boolean;
	action: 'test_policy';
	testResults: TestACLResponse | undefined;
	error: string | undefined;
};

export type SavePolicyResponse = {
	success: boolean;
	action: 'save_policy';
	error: string | undefined;
	policy: string | undefined;
	updatedAt: Date | undefined;
	testResults: TestACLResponse | undefined;
};

export const testError = (error: string, status = 400) =>
	data<TestPolicyResponse>(
		{ success: false, action: 'test_policy', testResults: undefined, error },
		status,
	);

export const testSuccess = (testResults: TestACLResponse) =>
	data<TestPolicyResponse>({
		success: true,
		action: 'test_policy',
		testResults,
		error: undefined,
	});

export const saveError = (
	error: string,
	testResults?: TestACLResponse,
	status = 400,
) =>
	data<SavePolicyResponse>(
		{
			success: false,
			action: 'save_policy',
			error,
			policy: undefined,
			updatedAt: undefined,
			testResults,
		},
		status,
	);

export const saveSuccess = (policy: string, updatedAt: Date) =>
	data<SavePolicyResponse>({
		success: true,
		action: 'save_policy',
		error: undefined,
		policy,
		updatedAt,
		testResults: undefined,
	});
