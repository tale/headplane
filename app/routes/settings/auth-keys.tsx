import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { useLiveData } from '~/utils/useLiveData';
import { getSession } from '~/utils/sessions';
import { Link as RemixLink } from 'react-router';
import type { PreAuthKey, User } from '~/types';
import { pull, post } from '~/utils/headscale';
import { loadContext } from '~/utils/config/headplane';
import { useState } from 'react';
import { send } from '~/utils/res';

import Link from '~/components/Link';
import TableList from '~/components/TableList';
import Select from '~/components/Select';
import Switch from '~/components/Switch';

import AddPreAuthKey from './dialogs/new';
import AuthKeyRow from './components/key';

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

export async function loader({ request }: LoaderFunctionArgs) {
	const context = await loadContext();
	const session = await getSession(request.headers.get('Cookie'));
	const users = await pull<{ users: User[] }>(
		'v1/user',
		session.get('hsApiKey')!,
	);

	const preAuthKeys = await Promise.all(
		users.users.map((user) => {
			const qp = new URLSearchParams();
			qp.set('user', user.name);

			return pull<{ preAuthKeys: PreAuthKey[] }>(
				`v1/preauthkey?${qp.toString()}`,
				session.get('hsApiKey')!,
			);
		}),
	);

	return {
		keys: preAuthKeys.flatMap((keys) => keys.preAuthKeys),
		users: users.users,
		server: context.headscalePublicUrl ?? context.headscaleUrl,
	};
}

export default function Page() {
	const { keys, users, server } = useLoaderData<typeof loader>();
	const [user, setUser] = useState('All');
	const [status, setStatus] = useState('Active');
	useLiveData({ interval: 3000 });

	const filteredKeys = keys.filter((key) => {
		if (user !== 'All' && key.user !== user) {
			return false;
		}

		if (status !== 'All') {
			const now = new Date();
			const expiry = new Date(key.expiration);

			if (status === 'Active') {
				return !(expiry < now) && !key.used;
			}

			if (status === 'Used/Expired') {
				return key.used || expiry < now;
			}

			if (status === 'Reusable') {
				return key.reusable;
			}

			if (status === 'Ephemeral') {
				return key.ephemeral;
			}
		}

		return true;
	});

	return (
		<div className="flex flex-col w-2/3">
			<p className="mb-8 text-md">
				<RemixLink to="/settings" className="font-medium">
					Settings
				</RemixLink>
				<span className="mx-2">/</span> Pre-Auth Keys
			</p>
			<h1 className="text-2xl font-medium mb-4">Pre-Auth Keys</h1>
			<p className="text-gray-700 dark:text-gray-300 mb-4">
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
			<div className="flex justify-between gap-4 mt-4">
				<div className="w-full">
					<p className="text-sm text-gray-500 dark:text-gray-300">
						Filter by user
					</p>
					<Select
						label="Filter by User"
						placeholder="Select a user"
						state={[user, setUser]}
					>
						<Select.Item id="All">All</Select.Item>
						{users.map((user) => (
							<Select.Item key={user.id} id={user.name}>
								{user.name}
							</Select.Item>
						))}
					</Select>
				</div>
				<div className="w-full">
					<p className="text-sm text-gray-500 dark:text-gray-300">
						Filter by status
					</p>
					<Select
						label="Filter by status"
						placeholder="Select a status"
						state={[status, setStatus]}
					>
						<Select.Item id="All">All</Select.Item>
						<Select.Item id="Active">Active</Select.Item>
						<Select.Item id="Used/Expired">Used/Expired</Select.Item>
						<Select.Item id="Reusable">Reusable</Select.Item>
						<Select.Item id="Ephemeral">Ephemeral</Select.Item>
					</Select>
				</div>
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
