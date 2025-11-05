import { useEffect, useState } from 'react';
import { Capabilities } from '~/server/web/roles';
import type { Machine, User } from '~/types';
import cn from '~/utils/cn';
import type { Route } from './+types/overview';
import ManageBanner from './components/manage-banner';
import UserRow from './components/user-row';
import { userAction } from './user-actions';

interface UserMachine extends User {
	machines: Machine[];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const session = await context.sessions.auth(request);
	const check = await context.sessions.check(request, Capabilities.read_users);
	if (!check) {
		// Not authorized to view this page
		throw new Error(
			'You do not have permission to view this page. Please contact your administrator.',
		);
	}

	const writablePermission = await context.sessions.check(
		request,
		Capabilities.write_users,
	);

	const api = context.hsApi.getRuntimeClient(session.api_key);
	const [nodes, apiUsers] = await Promise.all([api.getNodes(), api.getUsers()]);

	const users = apiUsers.map((user) => ({
		...user,
		machines: nodes.filter((node) => node.user.id === user.id),
	}));

	const roles = await Promise.all(
		users
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(async (user) => {
				if (user.provider !== 'oidc') {
					return 'no-oidc';
				}

				if (user.provider === 'oidc' && user.providerId) {
					// For some reason, headscale makes providerID a url where the
					// last component is the subject, so we need to strip that out
					const subject = user.providerId.split('/').pop();
					if (!subject) {
						return 'invalid-oidc';
					}

					const role = await context.sessions.roleForSubject(subject);
					return role ?? 'no-role';
				}

				// No role means the user is not registered in Headplane, but they
				// are in Headscale. We also need to handle what happens if someone
				// logs into the UI and they don't have a Headscale setup.
				return 'no-role';
			}),
	);

	let magic: string | undefined;
	if (context.hs.readable()) {
		if (context.hs.c?.dns.magic_dns) {
			magic = context.hs.c.dns.base_domain;
		}
	}

	return {
		writable: writablePermission, // whether the user can write to the API
		oidc: context.config.oidc
			? {
					issuer: context.config.oidc.issuer,
				}
			: undefined,
		roles,
		magic,
		users,
	};
}

export const action = userAction;

export default function Page({ loaderData }: Route.ComponentProps) {
	const [users, setUsers] = useState<UserMachine[]>(loaderData.users);

	// This useEffect is entirely for the purpose of updating the users when the
	// drag and drop changes the machines between users. It's pretty hacky, but
	// the idea is to treat data.users as the source of truth and update the
	// local state when it changes.
	useEffect(() => {
		setUsers(loaderData.users);
	}, [loaderData.users]);

	return (
		<>
			<h1 className="text-2xl font-medium mb-1.5">Users</h1>
			<p className="mb-8 text-md">
				Manage the users in your network and their permissions.
			</p>
			<ManageBanner isDisabled={!loaderData.writable} oidc={loaderData.oidc} />
			<table className="table-auto w-full rounded-lg">
				<thead className="text-headplane-600 dark:text-headplane-300">
					<tr className="text-left px-0.5">
						<th className="uppercase text-xs font-bold pb-2">User</th>
						<th className="uppercase text-xs font-bold pb-2">Role</th>
						<th className="uppercase text-xs font-bold pb-2">Created At</th>
						<th className="uppercase text-xs font-bold pb-2">Last Seen</th>
					</tr>
				</thead>
				<tbody
					className={cn(
						'divide-y divide-headplane-100 dark:divide-headplane-800 align-top',
						'border-t border-headplane-100 dark:border-headplane-800',
					)}
				>
					{users
						.sort((a, b) => a.name.localeCompare(b.name))
						.map((user) => (
							<UserRow
								key={user.id}
								role={loaderData.roles[users.indexOf(user)]}
								user={user}
							/>
						))}
				</tbody>
			</table>
		</>
	);
}
