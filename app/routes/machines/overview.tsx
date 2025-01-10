import { InfoIcon } from '@primer/octicons-react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';

import Code from '~/components/Code';
import Link from '~/components/Link';
import { cn } from '~/utils/cn';
import { loadContext } from '~/utils/config/headplane';
import { loadConfig } from '~/utils/config/headscale';
import { pull } from '~/utils/headscale';
import { getSession } from '~/utils/sessions.server';
import { useLiveData } from '~/utils/useLiveData';
import type { Machine, Route, User } from '~/types';
import { queryAgent, initAgentSocket } from '~/utils/ws-agent';

import { menuAction } from './action';
import MachineRow from './components/machine';
import NewMachine from './dialogs/new';

export async function loader({ request, context: lC }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	const [machines, routes, users] = await Promise.all([
		pull<{ nodes: Machine[] }>('v1/node', session.get('hsApiKey')!),
		pull<{ routes: Route[] }>('v1/routes', session.get('hsApiKey')!),
		pull<{ users: User[] }>('v1/user', session.get('hsApiKey')!),
	]);

	initAgentSocket(lC);

	const stats = await queryAgent(machines.nodes.map((node) => node.nodeKey));
	const context = await loadContext();
	let magic: string | undefined;

	if (context.config.read) {
		const config = await loadConfig();
		if (config.dns.magic_dns) {
			magic = config.dns.base_domain;
		}

		if (config.dns.use_username_in_magic_dns) {
			magic = `[user].${magic}`;
		}
	}

	return {
		nodes: machines.nodes,
		routes: routes.routes,
		users: users.users,
		magic,
		stats,
		server: context.headscaleUrl,
		publicServer: context.headscalePublicUrl,
	};
}

export async function action({ request }: ActionFunctionArgs) {
	return menuAction(request);
}

export default function Page() {
	useLiveData({ interval: 3000 });
	const data = useLoaderData<typeof loader>();

	return (
		<>
			<div className="flex justify-between items-center mb-8">
				<div className="flex flex-col w-2/3">
					<h1 className="text-2xl font-medium mb-4">Machines</h1>
					<p className="text-gray-700 dark:text-gray-300">
						Manage the devices connected to your Tailnet.{' '}
						<Link
							to="https://tailscale.com/kb/1372/manage-devices"
							name="Tailscale Manage Devices Documentation"
						>
							Learn more
						</Link>
					</p>
				</div>
				<NewMachine
					server={data.publicServer ?? data.server}
					users={data.users}
				/>
			</div>
			<table className="table-auto w-full rounded-lg">
				<thead className="text-gray-500 dark:text-gray-400">
					<tr className="text-left uppercase text-xs font-bold px-0.5">
						<th className="pb-2">Name</th>
						<th className="pb-2 w-1/4">
							<div className="flex items-center gap-x-1">
								Addresses
								{data.magic ? (
									<TooltipTrigger delay={0}>
										<Button>
											<InfoIcon className="w-4 h-4" />
										</Button>
										<Tooltip
											className={cn(
												'text-sm max-w-xs p-2 rounded-lg mb-2',
												'bg-white dark:bg-zinc-800',
												'border border-gray-200 dark:border-zinc-700',
											)}
										>
											Since MagicDNS is enabled, you can access devices based on
											their name and also at{' '}
											<Code>
												[name].
												{data.magic}
											</Code>
										</Tooltip>
									</TooltipTrigger>
								) : undefined}
							</div>
						</th>
						<th className="pb-2">Version</th>
						<th className="pb-2">Last Seen</th>
					</tr>
				</thead>
				<tbody
					className={cn(
						'divide-y divide-zinc-200 dark:divide-zinc-700 align-top',
						'border-t border-zinc-200 dark:border-zinc-700',
					)}
				>
					{data.nodes.map((machine) => (
						<MachineRow
							key={machine.id}
							machine={machine}
							routes={data.routes.filter(
								(route) => route.node.id === machine.id,
							)}
							users={data.users}
							magic={data.magic}
							stats={data.stats?.[machine.nodeKey]}
						/>
					))}
				</tbody>
			</table>
		</>
	);
}
