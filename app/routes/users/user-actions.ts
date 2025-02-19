import { ActionFunctionArgs, data } from 'react-router';
import { del, post } from '~/utils/headscale';
import { auth } from '~/utils/sessions.server';

export async function userAction({ request }: ActionFunctionArgs) {
	const session = await auth(request);
	if (!session) {
		return data({ success: false }, 401);
	}

	const formData = await request.formData();
	const action = formData.get('action_id')?.toString();
	if (!action) {
		return data({ success: false }, 400);
	}

	const apiKey = session.get('hsApiKey');
	if (!apiKey) {
		return data({ success: false }, 401);
	}

	switch (action) {
		case 'create_user':
			return createUser(formData, apiKey);
		case 'delete_user':
			return deleteUser(formData, apiKey);
		case 'rename_user':
			return renameUser(formData, apiKey);
		case 'change_owner':
			return changeOwner(formData, apiKey);
		default:
			return data({ success: false }, 400);
	}
}

async function createUser(formData: FormData, apiKey: string) {
	const name = formData.get('username')?.toString();
	const displayName = formData.get('display_name')?.toString();
	const email = formData.get('email')?.toString();

	if (!name) {
		return data({ success: false }, 400);
	}

	await post('v1/user', apiKey, {
		name,
		displayName,
		email,
	});
}

async function deleteUser(formData: FormData, apiKey: string) {
	const userId = formData.get('user_id')?.toString();
	if (!userId) {
		return data({ success: false }, 400);
	}

	await del(`v1/user/${userId}`, apiKey);
}

async function renameUser(formData: FormData, apiKey: string) {
	const userId = formData.get('user_id')?.toString();
	const newName = formData.get('new_name')?.toString();
	if (!userId || !newName) {
		return data({ success: false }, 400);
	}

	await post(`v1/user/${userId}/rename/${newName}`, apiKey);
}

async function changeOwner(formData: FormData, apiKey: string) {
	const userId = formData.get('user_id')?.toString();
	const nodeId = formData.get('node_id')?.toString();
	if (!userId || !nodeId) {
		return data({ success: false }, 400);
	}

	await post(`v1/node/${nodeId}/user`, apiKey, {
		user: userId,
	});
}
