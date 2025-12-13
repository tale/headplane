import { data } from 'react-router';
import { isApiError } from '~/server/headscale/api/error-client';
// import ResponseError from '~/server/headscale/api/response-error'; // Unused
import { Capabilities } from '~/server/web/roles';
import type { Route } from './+types/overview';

// We only check capabilities here and assume it is writable
// If it isn't, it'll gracefully error anyways, since this means some
// fishy client manipulation is happening.
interface DataWithResponseInit {
	data: {
		data?: {
			message?: string;
		};
		rawData?: string;
	};
	init: {
		status?: number;
		statusText?: string;
	};
}

function isDataWithResponseInit(error: unknown): error is DataWithResponseInit {
	return (
		typeof error === 'object' &&
		error !== null &&
		'data' in error &&
		'init' in error
	);
}

export async function aclAction({ request, context }: Route.ActionArgs) {
	const session = await context.sessions.auth(request);
	const check = await context.sessions.check(
		request,
		Capabilities.write_policy,
	);
	if (!check) {
		throw data('You do not have permission to write to the ACL policy', {
			status: 403,
		});
	}

	// Try to write to the ACL policy via the API or via config file (TODO).
	const formData = await request.formData();
	const policyData = formData.get('policy')?.toString();
	if (!policyData) {
		throw data('Missing `policy` in the form data.', {
			status: 400,
		});
	}

	const api = context.hsApi.getRuntimeClient(session.api_key);
	try {
		const { policy, updatedAt } = await api.setPolicy(policyData);
		return data({
			success: true,
			error: undefined,
			policy,
			updatedAt,
		});
		// biome-ignore lint/suspicious/noExplicitAny: Error handling needs to catch all types
	} catch (error: unknown) {
		console.error('ACL Action Error:', error);

		// Handle data() throw objects (DataWithResponseInit) which aren't instanceof Response
		// but have the structure: { data: { ... }, init: { status: 502, ... } }
		if (isDataWithResponseInit(error)) {
			const statusCode = error.init.status || 500;
			const statusText = error.init.statusText || 'Error';

			// The internal error from Headscale
			const internalData = error.data.data;
			let message = internalData?.message;

			if (!message) {
				// Fallback to raw data or stringified object
				message = error.data?.rawData || JSON.stringify(error.data);
			}

			// Clean up common prefixes if present
			if (typeof message === 'string') {
				if (message.includes('setting policy:')) {
					message = message.replace('setting policy:', '').trim();
				}
				if (message.includes('parsing policy:')) {
					message = message.replace('parsing policy:', '').trim();
				}
			}

			return data(
				{
					success: false,
					error: `${message}\n\nStatus: ${statusCode} ${statusText}`,
					policy: undefined,
					updatedAt: undefined,
				},
				// We return 200 or 400 to the UI so it renders the page with the error
				// instead of triggering an ErrorBoundary
				400,
			);
		}

		// This means Headscale returned a protobuf error to us
		// It also means we 100% know this is in database mode
		if (error instanceof Response) {
			try {
				const payload = await error.json();
				console.error('ACL Action Payload:', payload);

				if (isApiError(payload)) {
					let message =
						(payload.data?.message as string) ||
						payload.rawData ||
						'Unknown error';

					if (typeof message === 'object') {
						message = JSON.stringify(message);
					}

					// This is stupid, refer to the link
					// https://github.com/juanfont/headscale/blob/main/hscontrol/types/policy.go
					if (message.includes('update is disabled')) {
						// This means the policy is not writable
						return data(
							{
								success: false,
								error: 'Policy is not writable (File mode enabled)',
								policy: undefined,
								updatedAt: undefined,
							},
							403,
						);
					}

					// https://github.com/juanfont/headscale/blob/main/hscontrol/policy/v1/acls.go#L81
					if (message.includes('parsing hujson')) {
						// This means the policy was invalid, return a 400
						// with the actual error message from Headscale
						const cutIndex = message.indexOf('err: hujson:');
						const trimmed =
							cutIndex > -1
								? `Syntax error: ${message.slice(cutIndex + 12)}`
								: message;

						return data(
							{
								success: false,
								error: trimmed,
								policy: undefined,
								updatedAt: undefined,
							},
							400,
						);
					}

					if (message.includes('unmarshalling policy')) {
						// This means the policy was invalid, return a 400
						// with the actual error message from Headscale
						const cutIndex = message.indexOf('err:');
						const trimmed =
							cutIndex > -1
								? `Syntax error: ${message.slice(cutIndex + 5)}`
								: message;

						return data(
							{
								success: false,
								error: trimmed,
								policy: undefined,
								updatedAt: undefined,
							},
							400,
						);
					}

					if (message.includes('empty policy')) {
						return data(
							{
								success: false,
								error: 'Policy error: Supplied policy was empty',
								policy: undefined,
								updatedAt: undefined,
							},
							400,
						);
					}

					// Return the raw error if no specific match
					return data(
						{
							success: false,
							error: message,
							policy: undefined,
							updatedAt: undefined,
						},
						payload.statusCode,
					);
				}
			} catch (e) {
				console.error('Failed to parse error response:', e);
			}
		}

		// Otherwise, catch generic errors and return them to the UI
		// instead of throwing (which triggers ErrorBoundary).
		return data(
			{
				success: false,
				error: error instanceof Error ? error.message : String(error),
				policy: undefined,
				updatedAt: undefined,
			},
			500,
		);
	}
}
