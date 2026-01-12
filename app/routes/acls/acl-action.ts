import { data } from 'react-router';
import { isDataWithApiError } from '~/server/headscale/api/error-client';
import { Capabilities } from '~/server/web/roles';
import type { Route } from './+types/overview';
import {
	getApiErrorMessage,
	parseSyntaxError,
	parseTestResultsFromError,
} from './utils/parsing';
import {
	saveError,
	saveSuccess,
	testError,
	testSuccess,
} from './utils/responses';

async function handleTestPolicy(
	request: Request,
	context: Route.ActionArgs['context'],
	policyData: string,
	apiKey: string,
) {
	const hasPermission = await context.sessions.check(
		request,
		Capabilities.read_policy,
	);
	if (!hasPermission) {
		throw data('You do not have permission to access the ACL policy', {
			status: 403,
		});
	}

	const api = context.hsApi.getRuntimeClient(apiKey);

	try {
		return testSuccess(await api.testPolicy(policyData));
	} catch (error) {
		// Handle client-side errors (syntax errors, no tests found, etc.)
		if (error instanceof Error) {
			if (
				error.message.includes('No tests found') ||
				error.message.includes('Syntax Error')
			) {
				return testError(error.message);
			}
		}

		if (!isDataWithApiError(error)) {
			// Unknown error - return generic message
			if (error instanceof Error) {
				return testError(`Error: ${error.message}`);
			}
			return testError('An unknown error occurred while testing the policy.');
		}

		const { statusCode } = error.data;
		if (statusCode === 404 || statusCode === 501) {
			return testError(
				'ACL testing is not supported by your Headscale version. Please upgrade to a version that includes ACL testing support.',
			);
		}

		const message = getApiErrorMessage(error.data.data);
		if (message) return testError(message);

		return testError(`Server Error: Failed to test policy (${statusCode}).`);
	}
}

async function handleSavePolicy(
	request: Request,
	context: Route.ActionArgs['context'],
	policyData: string,
	apiKey: string,
) {
	const hasPermission = await context.sessions.check(
		request,
		Capabilities.write_policy,
	);
	if (!hasPermission) {
		throw data('You do not have permission to write to the ACL policy', {
			status: 403,
		});
	}

	const api = context.hsApi.getRuntimeClient(apiKey);

	try {
		const { policy, updatedAt } = await api.setPolicy(policyData);
		return saveSuccess(policy, updatedAt);
	} catch (error) {
		return handleSaveError(error, context, policyData);
	}
}

function handleSaveError(
	error: unknown,
	context: Route.ActionArgs['context'],
	policyData: string,
) {
	if (!isDataWithApiError(error)) {
		if (error instanceof Error) {
			return saveError(`Error: ${error.message}`, undefined, 500);
		}
		return saveError(
			'Unknown Error: An unexpected error occurred.',
			undefined,
			500,
		);
	}

	const { rawData, statusCode, data: errorData } = error.data;

	// Gateway errors - Headscale unreachable
	if (statusCode >= 502 && statusCode <= 504) {
		return saveError(
			`Gateway Error: Headscale server is unavailable (${statusCode}).`,
			undefined,
			statusCode,
		);
	}

	// Policy updates disabled in config
	if (rawData.includes('update is disabled')) {
		return saveError(
			'Policy Error: Policy updates are disabled in Headscale configuration.',
			undefined,
			403,
		);
	}

	// Check for test failure results in error response
	const testResults = parseTestResultsFromError(errorData, policyData);
	if (testResults) {
		const failedCount = testResults.results.filter((r) => !r.passed).length;
		return saveError(
			`Test Failure: ${failedCount} test${failedCount !== 1 ? 's' : ''} failed`,
			testResults,
			statusCode,
		);
	}

	// Try to extract meaningful error message
	const message = getApiErrorMessage(errorData);
	if (message) {
		const isModernVersion = context.hsApi.clientHelpers.isAtleast('0.27.0');
		const syntaxError = parseSyntaxError(message, isModernVersion);
		if (syntaxError) return saveError(syntaxError, undefined, statusCode);
		return saveError(`Policy Error: ${message}`, undefined, statusCode);
	}

	return saveError(
		`Server Error: Failed to save policy (${statusCode}).`,
		undefined,
		statusCode,
	);
}

export async function aclAction({ request, context }: Route.ActionArgs) {
	const session = await context.sessions.auth(request);
	const formData = await request.formData();

	const actionType = formData.get('action')?.toString();
	const policyData = formData.get('policy')?.toString();

	if (!policyData) {
		throw data('Missing `policy` in the form data.', { status: 400 });
	}

	if (actionType === 'test_policy') {
		return handleTestPolicy(request, context, policyData, session.api_key);
	}

	return handleSavePolicy(request, context, policyData, session.api_key);
}
