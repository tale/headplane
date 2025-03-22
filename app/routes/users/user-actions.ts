import { ActionFunctionArgs, data } from 'react-router';
import type { LoadContext } from '~/server';

export async function userAction({
	request,
	context,
}: ActionFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
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
		case 'change_owner':
			return changeOwner(formData, apiKey, context);
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

async function changeOwner(
	formData: FormData,
	apiKey: string,
	context: LoadContext,
) {
	const userId = formData.get('user_id')?.toString();
	const nodeId = formData.get('node_id')?.toString();
	if (!userId || !nodeId) {
		return data({ success: false }, 400);
	}

	await context.client.post(`v1/node/${nodeId}/user`, apiKey, {
		user: userId,
	});
}
