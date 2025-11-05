import { data } from 'react-router';
import { Capabilities, Roles } from '~/server/web/roles';
import type { Route } from './+types/overview';

export async function userAction({ request, context }: Route.ActionArgs) {
	const session = await context.sessions.auth(request);
	const check = await context.sessions.check(request, Capabilities.write_users);
	if (!check) {
		throw data('You do not have permission to update users', {
			status: 403,
		});
	}

	const formData = await request.formData();
	const action = formData.get('action_id')?.toString();
	if (!action) {
		throw data('Missing `action_id` in the form data.', {
			status: 404,
		});
	}

	const api = context.hsApi.getRuntimeClient(session.api_key);
	switch (action) {
		case 'create_user': {
			const name = formData.get('username')?.toString();
			const displayName = formData.get('display_name')?.toString();
			const email = formData.get('email')?.toString();

			if (!name) {
				throw data('Missing `username` in the form data.', {
					status: 400,
				});
			}

			await api.createUser(name, email, displayName);
			return { message: 'User created successfully' };
		}
		case 'delete_user': {
			const userId = formData.get('user_id')?.toString();
			if (!userId) {
				throw data('Missing `user_id` in the form data.', {
					status: 400,
				});
			}

			await api.deleteUser(userId);
			return { message: 'User deleted successfully' };
		}
		case 'rename_user': {
			const userId = formData.get('user_id')?.toString();
			const newName = formData.get('new_name')?.toString();
			if (!userId || !newName) {
				return data({ success: false }, 400);
			}

			const users = await api.getUsers(userId);
			const user = users.find((user) => user.id === userId);
			if (!user) {
				throw data(`No user found with id: ${userId}`, { status: 400 });
			}

			if (user.provider === 'oidc') {
				// OIDC users cannot be renamed via this endpoint, return an error
				throw data('Users managed by OIDC cannot be renamed', {
					status: 403,
				});
			}

			await api.renameUser(userId, newName);
			return { message: 'User renamed successfully' };
		}
		case 'reassign_user': {
			const userId = formData.get('user_id')?.toString();
			const newRole = formData.get('new_role')?.toString();
			if (!userId || !newRole) {
				throw data('Missing `user_id` or `new_role` in the form data.', {
					status: 400,
				});
			}

			const users = await api.getUsers(userId);
			const user = users.find((user) => user.id === userId);
			if (!user?.providerId) {
				throw data('Specified user is not an OIDC user', {
					status: 400,
				});
			}

			// For some reason, headscale makes providerID a url where the
			// last component is the subject, so we need to strip that out
			const subject = user.providerId?.split('/').pop();
			if (!subject) {
				throw data(
					'Malformed `providerId` for the specified user. Cannot find subject.',
					{ status: 400 },
				);
			}

			const result = await context.sessions.reassignSubject(
				subject,
				newRole as keyof typeof Roles,
			);

			if (!result) {
				throw data('Failed to reassign user role.', { status: 500 });
			}

			return { message: 'User reassigned successfully' };
		}
		default:
			throw data('Invalid `action_id` provided.', {
				status: 400,
			});
	}
}
