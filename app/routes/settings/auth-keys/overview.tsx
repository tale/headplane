import { FileKey2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link as RemixLink } from 'react-router';
import Code from '~/components/Code';
import Link from '~/components/Link';
import Notice from '~/components/Notice';
import Select from '~/components/Select';
import TableList from '~/components/TableList';
import { Capabilities } from '~/server/web/roles';
import log from '~/utils/log';
import type { Route } from './+types/overview';
import { authKeysAction } from './actions';
import AuthKeyRow from './auth-key-row';
import AddAuthKey from './dialogs/add-auth-key';

export async function loader({ request, context }: Route.LoaderArgs) {
	const session = await context.sessions.auth(request);
	const api = context.hsApi.getRuntimeClient(session.api_key);

	const users = await api.getUsers();
	const preAuthKeys = await Promise.all(
		users
			.filter((user) => user.name?.length > 0) // Filter out any invalid users
			.map(async (user) => {
				try {
					const preAuthKeys = await api.getPreAuthKeys(user.id);
					return {
						success: true,
						user,
						preAuthKeys,
					};
				} catch (error) {
					log.error('api', 'GET /v1/preauthkey for %s: %o', user.name, error);
					return {
						success: false,
						user,
						error,
						preAuthKeys: [],
					};
				}
			}),
	);

	const keys = preAuthKeys
		.filter(({ success }) => success)
		.map(({ user, preAuthKeys }) => ({
			user,
			preAuthKeys,
		}));

	const missing = preAuthKeys
		.filter(({ success }) => !success)
		.map(({ user, error }) => ({
			user,
			error,
		}));

	return {
		keys,
		missing,
		users,
		access: await context.sessions.check(
			request,
			Capabilities.generate_authkeys,
		),
		url: context.config.headscale.public_url ?? context.config.headscale.url,
	};
}

export const action = authKeysAction;

type Status = 'all' | 'active' | 'expired' | 'reusable' | 'ephemeral';
export default function Page({
	loaderData: { keys, missing, users, url, access },
}: Route.ComponentProps) {
	const [selectedUser, setSelectedUser] = useState('__headplane_all');
	const [status, setStatus] = useState<Status>('active');
	const isDisabled =
		!access || keys.flatMap(({ preAuthKeys }) => preAuthKeys).length === 0;

	const filteredKeys = useMemo(() => {
		const now = new Date();
		return keys
			.filter(({ user }) => {
				if (selectedUser === '__headplane_all') {
					return true;
				}

				return user.id === selectedUser;
			})
			.flatMap(({ preAuthKeys }) => preAuthKeys)
			.filter((key) => {
				if (status === 'all') {
					return true;
				}

				if (status === 'ephemeral') {
					return key.ephemeral;
				}

				if (status === 'reusable') {
					return key.reusable;
				}

				const expiry = new Date(key.expiration);
				if (status === 'expired') {
					// Expired keys are either used or expired
					// BUT only used if they are not reusable
					if (key.used && !key.reusable) {
						return true;
					}

					return expiry < now;
				}

				if (status === 'active') {
					// Active keys are either not expired or reusable
					if (expiry < now) {
						return false;
					}

					if (!key.used) {
						return true;
					}

					return key.reusable;
				}

				return false;
			});
	}, [keys, selectedUser, status]);

	return (
		<div className="flex flex-col md:w-2/3">
			<p className="mb-8 text-md">
				<RemixLink className="font-medium" to="/settings">
					Settings
				</RemixLink>
				<span className="mx-2">/</span> Pre-Auth Keys
			</p>
			{!access ? (
				<Notice title="Pre-auth key permissions restricted" variant="warning">
					You do not have the necessary permissions to generate pre-auth keys.
					Please contact your administrator to request access or to generate a
					pre-auth key for you.
				</Notice>
			) : missing.length > 0 ? (
				<Notice title="Missing authentication keys" variant="error">
					An error occurred while fetching the authentication keys for the
					following users:{' '}
					{missing.map(({ user }, index) => (
						<>
							<Code key={user.name}>{user.name}</Code>
							{index < missing.length - 1 ? ', ' : '. '}
						</>
					))}
					Their keys may not be listed correctly. Please check the server logs
					for more information.
				</Notice>
			) : undefined}
			<h1 className="text-2xl font-medium mb-2">Pre-Auth Keys</h1>
			<p className="mb-4">
				Headscale fully supports pre-authentication keys in order to easily add
				devices to your Tailnet. To learn more about using pre-authentication
				keys, visit the{' '}
				<Link
					name="Tailscale Auth Keys documentation"
					to="https://tailscale.com/kb/1085/auth-keys/"
				>
					Tailscale documentation
				</Link>
			</p>
			<AddAuthKey users={users} />
			<div className="flex items-center gap-4 mt-4">
				<Select
					className="w-full"
					defaultSelectedKey="__headplane_all"
					isDisabled={isDisabled}
					label="User"
					onSelectionChange={(value) =>
						setSelectedUser(value?.toString() ?? '')
					}
					placeholder="Select a user"
				>
					{[
						<Select.Item key="__headplane_all">All</Select.Item>,
						...keys.map(({ user }) => (
							<Select.Item key={user.id}>
								{user.name || user.displayName || user.email || user.id}
							</Select.Item>
						)),
					]}
				</Select>
				<Select
					className="w-full"
					defaultSelectedKey="active"
					isDisabled={isDisabled}
					label="Status"
					onSelectionChange={(value) =>
						setStatus((value?.toString() ?? 'active') as Status)
					}
					placeholder="Select a status"
				>
					<Select.Item key="all">All</Select.Item>
					<Select.Item key="active">Active</Select.Item>
					<Select.Item key="expired">Used/Expired</Select.Item>
					<Select.Item key="reusable">Reusable</Select.Item>
					<Select.Item key="ephemeral">Ephemeral</Select.Item>
				</Select>
			</div>
			<TableList className="mt-4">
				{keys.flatMap(({ preAuthKeys }) => preAuthKeys).length === 0 ? (
					<TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
						<FileKey2 />
						<p className="font-semibold">
							No pre-auth keys have been created yet.
						</p>
					</TableList.Item>
				) : filteredKeys.length === 0 ? (
					<TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
						<FileKey2 />
						<p className="font-semibold">
							No pre-auth keys match the selected filters.
						</p>
					</TableList.Item>
				) : (
					filteredKeys.map((key) => {
						// TODO: Why is Headscale using email as the user ID here?
						// https://github.com/juanfont/headscale/issues/2520
						const user = users.find((user) => user.id === key.user.id);
						if (!user) {
							return null;
						}

						return (
							<TableList.Item key={key.id}>
								<AuthKeyRow authKey={key} url={url} user={user} />
							</TableList.Item>
						);
					})
				)}
			</TableList>
		</div>
	);
}
