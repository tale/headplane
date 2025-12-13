import { data } from 'react-router';
import { isDataWithApiError } from '~/server/headscale/api/error-client';
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
		flags.writable = updatedAt !== null;
		flags.policy = policy;
		return flags;
	} catch (error) {
		if (isDataWithApiError(error)) {
			// https://github.com/juanfont/headscale/blob/c4600346f9c29b514dc9725ac103efb9d0381f23/hscontrol/types/policy.go#L10
			if (error.data.rawData.includes('acl policy not found')) {
				flags.policy = '';
				flags.writable = true;
				return flags;
			}
		}

		throw error;
	}
}
