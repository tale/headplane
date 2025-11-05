import { data } from 'react-router';
import ResponseError from '~/server/headscale/api/response-error';
import { Capabilities } from '~/server/web/roles';
import type { Route } from './+types/overview';

// The logic for deciding policy factors is very complicated because
// there are so many factors that need to be accounted for:
// 1. Does the user have permission to read the policy?
// 2. Does the user have permission to write to the policy?
// 3. Is the Headscale policy in file or database mode?
//    If database, we can read/write easily via the API.
//    If in file mode, we can only write if context.config is available.
export async function aclLoader({ request, context }: Route.LoaderArgs) {
	const session = await context.sessions.auth(request);
	const check = await context.sessions.check(request, Capabilities.read_policy);
	if (!check) {
		throw data('You do not have permission to read the ACL policy.', {
			status: 403,
		});
	}

	const flags = {
		// Can the user write to the ACL policy
		access: await context.sessions.check(request, Capabilities.write_policy),
		writable: false,
		policy: '',
	};

	// Try to load the ACL policy from the API.
	const api = context.hsApi.getRuntimeClient(session.api_key);
	try {
		const { policy, updatedAt } = await api.getPolicy();

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
