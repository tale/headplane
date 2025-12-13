import { data } from 'react-router';
import { isDataWithApiError } from '~/server/headscale/api/error-client';
import { Capabilities } from '~/server/web/roles';
import type { Route } from './+types/overview';

// We only check capabilities here and assume it is writable
// If it isn't, it'll gracefully error anyways, since this means some
// fishy client manipulation is happening.
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
	} catch (error) {
		if (isDataWithApiError(error)) {
			const rawData = error.data.rawData;
			// https://github.com/juanfont/headscale/blob/c4600346f9c29b514dc9725ac103efb9d0381f23/hscontrol/types/policy.go#L11
			if (rawData.includes('update is disabled')) {
				throw data('Policy is not writable', { status: 403 });
			}

			const message =
				error.data.data != null &&
				'message' in error.data.data &&
				typeof error.data.data.message === 'string'
					? error.data.data.message
					: undefined;

			if (message == null) {
				throw error;
			}

			// Starting in Headscale 0.27.0 the ACLs parsing was changed meaning
			// we need to reference other error messages based on API version.
			if (context.hsApi.clientHelpers.isAtleast('0.27.0')) {
				if (message.includes('parsing HuJSON:')) {
					const cutIndex = message.indexOf('parsing HuJSON:');
					const trimmed =
						cutIndex > -1
							? `Syntax error: ${message.slice(cutIndex + 16).trim()}`
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

				if (message.includes('parsing policy from bytes:')) {
					const cutIndex = message.indexOf('parsing policy from bytes:');
					const trimmed =
						cutIndex > -1
							? `Syntax error: ${message.slice(cutIndex + 26).trim()}`
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
			} else {
				// Pre-0.27.0 error messages
				if (message.includes('parsing hujson')) {
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
			}
		}

		// Otherwise, this is a Headscale error that we can just propagate.
		throw error;
	}
}
