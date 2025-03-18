import { useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { Link as RemixLink } from 'react-router';
import Link from '~/components/Link';
import Select from '~/components/Select';
import TableList from '~/components/TableList';
import type { PreAuthKey, User } from '~/types';
import { post, pull } from '~/utils/headscale';
import { send } from '~/utils/res';
import { getSession } from '~/utils/sessions.server';
import { hp_getConfig } from '~server/context/global';
import AuthKeyRow from './components/key';
import AddPreAuthKey from './dialogs/new';

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	const users = await pull<{ users: User[] }>(
		'v1/user',
		session.get('hsApiKey')!,
	);

	const context = hp_getConfig();
	const preAuthKeys = await Promise.all(
		users.users.map((user) => {
			const qp = new URLSearchParams();
			qp.set('user', user.name);

			var result =  pull<{ preAuthKeys: PreAuthKey[] }>(
				`v1/preauthkey?${qp.toString()}`,
				session.get('hsApiKey')!,
			);
			
			// Change the email returned by Headscale API to username
		        result.forEach((preauthkey_item, index) => {
			    preauthkey_item.user = user.name;
			});
			
			return result;
		}),
	);

	return {
		keys: preAuthKeys.flatMap((keys) => keys.preAuthKeys),
		users: users.users,
		server: context.headscale.public_url ?? context.headscale.url,
	};
}

export async function action({ request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	if (!session.has('hsApiKey')) {
		return send(
			{ message: 'Unauthorized' },
			{
				status: 401,
			},
		);
	}

	const data = await request.formData();

	// Expiring a pre-auth key
	if (request.method === 'DELETE') {
		const key = data.get('key');
		const user = data.get('user');

		if (!key || !user) {
			return send(
				{ message: 'Missing parameters' },
				{
					status: 400,
				},
			);
		}

		await post<{ preAuthKey: PreAuthKey }>(
			'v1/preauthkey/expire',
			session.get('hsApiKey')!,
			{
				user: user,
				key: key,
			},
		);

		return { message: 'Pre-auth key expired' };
	}

	// Creating a new pre-auth key
	if (request.method === 'POST') {
		const user = data.get('user');
		const expiry = data.get('expiry');
		const reusable = data.get('reusable');
		const ephemeral = data.get('ephemeral');

		if (!user || !expiry || !reusable || !ephemeral) {
			return send(
				{ message: 'Missing parameters' },
				{
					status: 400,
				},
			);
		}

		// Extract the first "word" from expiry which is the day number
		// Calculate the date X days from now using the day number
		const day = Number(expiry.toString().split(' ')[0]);
		const date = new Date();
		date.setDate(date.getDate() + day);

		const key = await post<{ preAuthKey: PreAuthKey }>(
			'v1/preauthkey',
			session.get('hsApiKey')!,
			{
				user: user,
				ephemeral: ephemeral === 'on',
				reusable: reusable === 'on',
				expiration: date.toISOString(),
				aclTags: [], // TODO
			},
		);

		return { message: 'Pre-auth key created', key };
	}
}

export default function Page() {
	const { keys, users, server } = useLoaderData<typeof loader>();
	const [user, setUser] = useState('__headplane_all');
	const [status, setStatus] = useState('active');

	const filteredKeys = keys.filter((key) => {
		if (user !== '__headplane_all' && key.user !== user) {
			return false;
		}

		if (status !== 'all') {
			const now = new Date();
			const expiry = new Date(key.expiration);

			if (status === 'active') {
				return !(expiry < now) && (!key.used || key.reusable);
			}

			if (status === 'expired') {
				return key.used || expiry < now;
			}

			if (status === 'reusable') {
				return key.reusable;
			}

			if (status === 'ephemeral') {
				return key.ephemeral;
			}
		}

		return true;
	});

	// TODO: Fix the selects
	return (
		<div className="flex flex-col w-2/3">
			<p className="mb-8 text-md">
				<RemixLink to="/settings" className="font-medium">
					Settings
				</RemixLink>
				<span className="mx-2">/</span> Pre-Auth Keys
			</p>
			<h1 className="text-2xl font-medium mb-2">Pre-Auth Keys</h1>
			<p className="mb-4">
				Headscale fully supports pre-authentication keys in order to easily add
				devices to your Tailnet. To learn more about using pre-authentication
				keys, visit the{' '}
				<Link
					to="https://tailscale.com/kb/1085/auth-keys/"
					name="Tailscale Auth Keys documentation"
				>
					Tailscale documentation
				</Link>
			</p>
			<AddPreAuthKey users={users} />
			<div className="flex items-center gap-4 mt-4">
				<Select
					label="Filter by User"
					placeholder="Select a user"
					className="w-full"
					defaultSelectedKey="__headplane_all"
					onSelectionChange={(value) => setUser(value?.toString() ?? '')}
				>
					{[
						<Select.Item key="__headplane_all">All</Select.Item>,
						...users.map((user) => (
							<Select.Item key={user.name}>{user.name}</Select.Item>
						)),
					]}
				</Select>
				<Select
					label="Filter by status"
					placeholder="Select a status"
					className="w-full"
					defaultSelectedKey="active"
					onSelectionChange={(value) => setStatus(value?.toString() ?? '')}
				>
					<Select.Item key="all">All</Select.Item>
					<Select.Item key="active">Active</Select.Item>
					<Select.Item key="expired">Used/Expired</Select.Item>
					<Select.Item key="reusable">Reusable</Select.Item>
					<Select.Item key="ephemeral">Ephemeral</Select.Item>
				</Select>
			</div>
			<TableList className="mt-4">
				{filteredKeys.length === 0 ? (
					<TableList.Item>
						<p className="opacity-50 text-sm mx-auto">No pre-auth keys</p>
					</TableList.Item>
				) : (
					filteredKeys.map((key) => (
						<TableList.Item key={key.id}>
							<AuthKeyRow authKey={key} server={server} />
						</TableList.Item>
					))
				)}
			</TableList>
		</div>
	);
}
