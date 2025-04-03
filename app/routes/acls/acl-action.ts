import { ActionFunctionArgs, data } from 'react-router';
import { LoadContext } from '~/server';
import ResponseError from '~/server/headscale/api-error';
import { Capabilities } from '~/server/web/roles';
import { data400, data403 } from '~/utils/res';

// We only check capabilities here and assume it is writable
// If it isn't, it'll gracefully error anyways, since this means some
// fishy client manipulation is happening.
export async function aclAction({
	request,
	context,
}: ActionFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
	const check = await context.sessions.check(
		request,
		Capabilities.write_policy,
	);
	if (!check) {
		throw data403('You do not have permission to write to the ACL policy');
	}

	// Try to write to the ACL policy via the API or via config file (TODO).
	const formData = await request.formData();
	const policyData = formData.get('policy')?.toString();
	if (!policyData) {
		throw data400('Missing `policy` in the form data.');
	}

	try {
		const { policy, updatedAt } = await context.client.put<{
			policy: string;
			updatedAt: string;
		}>('v1/policy', session.get('api_key')!, {
			policy: policyData,
		});

		return data({
			success: true,
			error: undefined,
			policy,
			updatedAt,
		});
	} catch (error) {
		// This means Headscale returned a protobuf error to us
		// It also means we 100% know this is in database mode
		if (error instanceof ResponseError && error.responseObject?.message) {
			const message = error.responseObject.message as string;
			// This is stupid, refer to the link
			// https://github.com/juanfont/headscale/blob/main/hscontrol/types/policy.go
			if (message.includes('update is disabled')) {
				// This means the policy is not writable
				throw data403('Policy is not writable');
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
		}

		// Otherwise, this is a Headscale error that we can just propagate.
		throw error;
	}
}
