import { InfoIcon } from '@primer/octicons-react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';

import Code from '~/components/Code';
import { ErrorPopup } from '~/components/Error';
import Link from '~/components/Link';
import type { Machine, Route, User } from '~/types';
import cn from '~/utils/cn';
import { pull } from '~/utils/headscale';
import { getSession } from '~/utils/sessions.server';

import Tooltip from '~/components/Tooltip';
import { hs_getConfig } from '~/utils/config/loader';
import useAgent from '~/utils/useAgent';
import { hp_getConfig, hp_getSingletonUnsafe } from '~server/context/global';
import { menuAction } from './action';
import MachineRow from './components/machine';
import NewMachine from './dialogs/new';

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	const [machines, routes, users] = await Promise.all([
		pull<{ nodes: Machine[] }>('v1/node', session.get('hsApiKey')!),
		pull<{ routes: Route[] }>('v1/routes', session.get('hsApiKey')!),
		pull<{ users: User[] }>('v1/user', session.get('hsApiKey')!),
	]);

	const context = hp_getConfig();
	const { mode, config } = hs_getConfig();
	let magic: string | undefined;

	if (mode !== 'no') {
		if (config.dns.magic_dns) {
			magic = config.dns.base_domain;
		}
	}

	return {
		nodes: machines.nodes,
		routes: routes.routes,
		users: users.users,
		magic,
		server: context.headscale.url,
		publicServer: context.headscale.public_url,
		agents: [...(hp_getSingletonUnsafe('ws_agents') ?? []).keys()],
	};
}

export async function action({ request }: ActionFunctionArgs) {
	return menuAction(request);
}

export default function Page() {
	const data = useLoaderData<typeof loader>();
	const { data: stats } = useAgent(data.nodes.map((node) => node.nodeKey));

	return (
		<>
			<div className="flex justify-between items-center mb-6">
				<div className="flex flex-col w-2/3">
					<h1 className="text-2xl font-medium mb-2">Machines</h1>
					<p>
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
				<thead className="text-headplane-600 dark:text-headplane-300">
					<tr className="text-left px-0.5">
						<th className="uppercase text-xs font-bold pb-2">Name</th>
						<th className="pb-2 w-1/4">
							<div className="flex items-center gap-x-1">
								<p className="uppercase text-xs font-bold">Addresses</p>
								{data.magic ? (
									<Tooltip>
										<InfoIcon className="w-4 h-4" />
										<Tooltip.Body className="font-normal">
											Since MagicDNS is enabled, you can access devices based on
											their name and also at{' '}
											<Code>
												[name].
												{data.magic}
											</Code>
										</Tooltip.Body>
									</Tooltip>
								) : undefined}
							</div>
						</th>
						<th className="uppercase text-xs font-bold pb-2">Version</th>
						<th className="uppercase text-xs font-bold pb-2">Last Seen</th>
					</tr>
				</thead>
				<tbody
					className={cn(
						'divide-y divide-headplane-100 dark:divide-headplane-800 align-top',
						'border-t border-headplane-100 dark:border-headplane-800',
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
							stats={stats?.[machine.nodeKey]}
							isAgent={data.agents.includes(machine.id)}
						/>
					))}
				</tbody>
			</table>
		</>
	);
}

export function ErrorBoundary() {
	return <ErrorPopup type="embedded" />;
}
