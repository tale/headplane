import { LoaderFunctionArgs } from 'react-router';
import { LoadContext } from '~/server';
import ResponseError from '~/server/headscale/api-error';
import { Capabilities } from '~/server/web/roles';
import { data403 } from '~/utils/res';

// The logic for deciding policy factors is very complicated because
// there are so many factors that need to be accounted for:
// 1. Does the user have permission to read the policy?
// 2. Does the user have permission to write to the policy?
// 3. Is the Headscale policy in file or database mode?
//    If database, we can read/write easily via the API.
//    If in file mode, we can only write if context.config is available.
// TODO: Consider adding back file editing mode instead of database
export async function aclLoader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
	const check = await context.sessions.check(request, Capabilities.read_policy);
	if (!check) {
		throw data403('You do not have permission to read the ACL policy.');
	}

	const flags = {
		// Can the user write to the ACL policy
		access: await context.sessions.check(request, Capabilities.write_policy),
		writable: false,
		policy: '',
	};

	// Try to load the ACL policy from the API.
	try {
		const { policy, updatedAt } = await context.client.get<{
			policy: string;
			updatedAt: string | null;
		}>('v1/policy', session.get('api_key')!);

		// Successfully loaded the policy, mark it as readable
		// If `updatedAt` is null, it means the policy is in file mode.
		flags.writable = updatedAt !== null;
		flags.policy = policy;
		return flags;
	} catch (error) {
		// This means Headscale returned a protobuf error to us
		// It also means we 100% know this is in database mode
		if (error instanceof ResponseError && error.responseObject?.message) {
			const message = error.responseObject.message as string;
			// This is stupid, refer to the link
			// https://github.com/juanfont/headscale/blob/main/hscontrol/types/policy.go
			if (message.includes('acl policy not found')) {
				// This means the policy has never been initiated, and we can
				// write to it to get it started or ignore it.
				flags.policy = ''; // Start with an empty policy
				flags.writable = true;
			}

			return flags;
		}

		// Otherwise, this is a Headscale error that we can just propagate.
		throw error;
	}
}
