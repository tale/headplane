import { data } from 'react-router';
import { Capabilities } from '~/server/web/roles';
import type { Route } from './+types/overview';

export async function restrictionAction({
	request,
	context,
}: Route.ActionArgs) {
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

	// We only need healthchecks which don't rely on an API key
	const api = context.hsApi.getRuntimeClient('fake-api-key');
	switch (action) {
		case 'add_domain': {
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

			context.integration?.onConfigChange(api);
			return data('Domain added successfully.');
		}

		case 'remove_domain': {
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
			context.integration?.onConfigChange(api);
			return data('Domain removed successfully.');
		}

		case 'add_group': {
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

			context.integration?.onConfigChange(api);
			return data('Group added successfully.');
		}

		case 'remove_group': {
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

			context.integration?.onConfigChange(api);
			return data('Group removed successfully.');
		}

		case 'add_user': {
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

			context.integration?.onConfigChange(api);
			return data('User added successfully.');
		}

		case 'remove_user': {
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

			context.integration?.onConfigChange(api);
			return data('User removed successfully.');
		}

		default: {
			throw data('Invalid action provided.', {
				status: 400,
			});
		}
	}
}
