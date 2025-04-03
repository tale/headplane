import { ActionFunctionArgs, Session, data } from 'react-router';
import type { LoadContext } from '~/server';
import { Capabilities, Roles } from '~/server/web/roles';
import { AuthSession } from '~/server/web/sessions';
import { User } from '~/types';

export async function userAction({
	request,
	context,
}: ActionFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
	const check = await context.sessions.check(request, Capabilities.write_users);
	if (!check) {
		return data({ success: false }, 403);
	}

	const apiKey = session.get('api_key')!;
	const formData = await request.formData();
	const action = formData.get('action_id')?.toString();
	if (!action) {
		return data({ success: false }, 400);
	}

	switch (action) {
		case 'create_user':
			return createUser(formData, apiKey, context);
		case 'delete_user':
			return deleteUser(formData, apiKey, context);
		case 'rename_user':
			return renameUser(formData, apiKey, context);
		case 'reassign_user':
			return reassignUser(formData, apiKey, context, session);
		default:
			return data({ success: false }, 400);
	}
}

async function createUser(
	formData: FormData,
	apiKey: string,
	context: LoadContext,
) {
	const name = formData.get('username')?.toString();
	const displayName = formData.get('display_name')?.toString();
	const email = formData.get('email')?.toString();

	if (!name) {
		return data({ success: false }, 400);
	}

	await context.client.post('v1/user', apiKey, {
		name,
		displayName,
		email,
	});
}

async function deleteUser(
	formData: FormData,
	apiKey: string,
	context: LoadContext,
) {
	const userId = formData.get('user_id')?.toString();
	if (!userId) {
		return data({ success: false }, 400);
	}

	await context.client.delete(`v1/user/${userId}`, apiKey);
}

async function renameUser(
	formData: FormData,
	apiKey: string,
	context: LoadContext,
) {
	const userId = formData.get('user_id')?.toString();
	const newName = formData.get('new_name')?.toString();
	if (!userId || !newName) {
		return data({ success: false }, 400);
	}

	await context.client.post(`v1/user/${userId}/rename/${newName}`, apiKey);
}

async function reassignUser(
	formData: FormData,
	apiKey: string,
	context: LoadContext,
	session: Session<AuthSession, unknown>,
) {
	const userId = formData.get('user_id')?.toString();
	const newRole = formData.get('new_role')?.toString();
	if (!userId || !newRole) {
		return data({ success: false }, 400);
	}

	const { users } = await context.client.get<{ users: User[] }>(
		'v1/user',
		apiKey,
	);

	const user = users.find((user) => user.id === userId);
	if (!user?.providerId) {
		return data({ success: false }, 400);
	}

	// For some reason, headscale makes providerID a url where the
	// last component is the subject, so we need to strip that out
	const subject = user.providerId?.split('/').pop();
	if (!subject) {
		return data({ success: false }, 400);
	}

	const result = await context.sessions.reassignSubject(
		subject,
		newRole as keyof typeof Roles,
	);

	if (!result) {
		return data({ success: false }, 403);
	}

	return data({ success: true });
}
