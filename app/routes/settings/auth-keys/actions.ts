import { ActionFunctionArgs, data } from 'react-router';
import { LoadContext } from '~/server';
import { Capabilities } from '~/server/web/roles';
import { PreAuthKey } from '~/types';

export async function authKeysAction({
	request,
	context,
}: ActionFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
	const check = await context.sessions.check(
		request,
		Capabilities.generate_authkeys,
	);

	if (!check) {
		throw data('You do not have permission to manage pre-auth keys', {
			status: 403,
		});
	}

	const formData = await request.formData();
	const apiKey = session.get('api_key')!;
	const action = formData.get('action_id')?.toString();
	if (!action) {
		throw data('Missing `action_id` in the form data.', {
			status: 400,
		});
	}

	switch (action) {
		case 'add_preauthkey':
			return await addPreAuthKey(formData, apiKey, context);
		case 'expire_preauthkey':
			return await expirePreAuthKey(formData, apiKey, context);
		default:
			return data('Invalid action', {
				status: 400,
			});
	}
}

async function addPreAuthKey(
	formData: FormData,
	apiKey: string,
	context: LoadContext,
) {
	const user = formData.get('user_id')?.toString();
	if (!user) {
		return data('Missing `user_id` in the form data.', {
			status: 400,
		});
	}

	const expiry = formData.get('expiry')?.toString();
	if (!expiry) {
		return data('Missing `expiry` in the form data.', {
			status: 400,
		});
	}

	const reusable = formData.get('reusable')?.toString();
	if (!reusable) {
		return data('Missing `reusable` in the form data.', {
			status: 400,
		});
	}

	const ephemeral = formData.get('ephemeral')?.toString();
	if (!ephemeral) {
		return data('Missing `ephemeral` in the form data.', {
			status: 400,
		});
	}

	// Extract the first "word" from expiry which is the day number
	// Calculate the date X days from now using the day number
	const day = Number(expiry.toString().split(' ')[0]);
	const date = new Date();
	date.setDate(date.getDate() + day);

	await context.client.post<{ preAuthKey: PreAuthKey }>(
		'v1/preauthkey',
		apiKey,
		{
			user,
			ephemeral: ephemeral === 'on',
			reusable: reusable === 'on',
			expiration: date.toISOString(),
			aclTags: [], // TODO
		},
	);

	return data('Pre-auth key created');
}

async function expirePreAuthKey(
	formData: FormData,
	apiKey: string,
	context: LoadContext,
) {
	const key = formData.get('key')?.toString();
	if (!key) {
		return data('Missing `key` in the form data.', {
			status: 400,
		});
	}

	const user = formData.get('user_id')?.toString();
	if (!user) {
		return data('Missing `user_id` in the form data.', {
			status: 400,
		});
	}

	await context.client.post('v1/preauthkey/expire', apiKey, { user, key });
	return data('Pre-auth key expired');
}
