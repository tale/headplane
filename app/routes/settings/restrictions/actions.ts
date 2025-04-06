import { ActionFunctionArgs, data } from 'react-router';
import { LoadContext } from '~/server';
import { Capabilities } from '~/server/web/roles';

export async function restrictionAction({
	request,
	context,
}: ActionFunctionArgs<LoadContext>) {
	const check = await context.sessions.check(
		request,
		Capabilities.configure_iam,
	);

	if (!check) {
		throw data('You do not have permission to modify IAM settings.', {
			status: 403,
		});
	}

	if (!context.hs.writable()) {
		throw data('The Headscale configuration file is not editable.', {
			status: 403,
		});
	}

	const formData = await request.formData();
	const action = formData.get('action_id')?.toString();
	if (!action) {
		throw data('No action provided.', {
			status: 400,
		});
	}

	switch (action) {
		case 'add_domain': {
			return addDomain(formData, context);
		}

		case 'remove_domain': {
			return removeDomain(formData, context);
		}

		case 'add_group': {
			return addGroup(formData, context);
		}

		case 'remove_group': {
			return removeGroup(formData, context);
		}

		case 'add_user': {
			return addUser(formData, context);
		}

		case 'remove_user': {
			return removeUser(formData, context);
		}

		default: {
			throw data('Invalid action provided.', {
				status: 400,
			});
		}
	}
}

async function addDomain(formData: FormData, context: LoadContext) {
	const domain = formData.get('domain')?.toString()?.trim();
	if (!domain) {
		throw data('No domain provided.', {
			status: 400,
		});
	}

	const domains = [
		...new Set([...(context.hs.c?.oidc?.allowed_domains ?? []), domain]),
	];

	await context.hs.patch([
		{
			path: 'oidc.allowed_domains',
			value: domains,
		},
	]);

	context.integration?.onConfigChange(context.client);
	return data('Domain added successfully.');
}

async function removeDomain(formData: FormData, context: LoadContext) {
	const domain = formData.get('domain')?.toString()?.trim();
	if (!domain) {
		throw data('No domain provided.', {
			status: 400,
		});
	}

	const storedDomains = context.hs.c?.oidc?.allowed_domains ?? [];
	if (!storedDomains.includes(domain)) {
		// Domain not found in the list
		throw data(`Domain "${domain}" not found in allowed domains.`, {
			status: 400,
		});
	}

	// Filter out the domain to remove it from the list
	const domains = storedDomains.filter((d: string) => d !== domain);
	await context.hs.patch([
		{
			path: 'oidc.allowed_domains',
			value: domains,
		},
	]);

	context.integration?.onConfigChange(context.client);
	return data('Domain removed successfully.');
}

async function addUser(formData: FormData, context: LoadContext) {
	const user = formData.get('user')?.toString()?.trim();
	if (!user) {
		throw data('No user provided.', {
			status: 400,
		});
	}

	const users = [
		...new Set([...(context.hs.c?.oidc?.allowed_users ?? []), user]),
	];

	await context.hs.patch([
		{
			path: 'oidc.allowed_users',
			value: users,
		},
	]);

	context.integration?.onConfigChange(context.client);
	return data('User added successfully.');
}

async function removeUser(formData: FormData, context: LoadContext) {
	const user = formData.get('user')?.toString()?.trim();
	if (!user) {
		throw data('No user provided.', {
			status: 400,
		});
	}

	const storedUsers = context.hs.c?.oidc?.allowed_users ?? [];
	if (!storedUsers.includes(user)) {
		// User not found in the list
		throw data(`User "${user}" not found in allowed users.`, {
			status: 400,
		});
	}

	// Filter out the user to remove it from the list
	const users = storedUsers.filter((d: string) => d !== user);
	await context.hs.patch([
		{
			path: 'oidc.allowed_users',
			value: users,
		},
	]);

	context.integration?.onConfigChange(context.client);
	return data('User removed successfully.');
}

async function addGroup(formData: FormData, context: LoadContext) {
	const group = formData.get('group')?.toString()?.trim();
	if (!group) {
		throw data('No group provided.', {
			status: 400,
		});
	}

	const groups = [
		...new Set([...(context.hs.c?.oidc?.allowed_groups ?? []), group]),
	];

	await context.hs.patch([
		{
			path: 'oidc.allowed_groups',
			value: groups,
		},
	]);

	context.integration?.onConfigChange(context.client);
	return data('Group added successfully.');
}

async function removeGroup(formData: FormData, context: LoadContext) {
	const group = formData.get('group')?.toString()?.trim();
	if (!group) {
		throw data('No group provided.', {
			status: 400,
		});
	}

	const storedGroups = context.hs.c?.oidc?.allowed_groups ?? [];
	if (!storedGroups.includes(group)) {
		// Group not found in the list
		throw data(`Group "${group}" not found in allowed groups.`, {
			status: 400,
		});
	}

	// Filter out the group to remove it from the list
	const groups = storedGroups.filter((d: string) => d !== group);
	await context.hs.patch([
		{
			path: 'oidc.allowed_groups',
			value: groups,
		},
	]);

	context.integration?.onConfigChange(context.client);
	return data('Group removed successfully.');
}
