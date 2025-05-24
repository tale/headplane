import { InfoIcon } from '@primer/octicons-react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import Code from '~/components/Code';
import Link from '~/components/Link';
import Tooltip from '~/components/Tooltip';
import type { LoadContext } from '~/server';
import { Capabilities } from '~/server/web/roles';
import type { Machine, User } from '~/types';
import cn from '~/utils/cn';
import { mapNodes } from '~/utils/node-info';
import MachineRow from './components/machine-row';
import NewMachine from './dialogs/new';
import { machineAction } from './machine-actions';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
	const user = session.get('user');
	if (!user) {
		throw new Error('Missing user session. Please log in again.');
	}

	const check = await context.sessions.check(
		request,
		Capabilities.read_machines,
	);

	if (!check) {
		// Not authorized to view this page
		throw new Error(
			'You do not have permission to view this page. Please contact your administrator.',
		);
	}

	const writablePermission = await context.sessions.check(
		request,
		Capabilities.write_machines,
	);

	const [{ nodes }, { users }] = await Promise.all([
		context.client.get<{ nodes: Machine[] }>(
			'v1/node',
			session.get('api_key')!,
		),
		context.client.get<{ users: User[] }>('v1/user', session.get('api_key')!),
	]);

	let magic: string | undefined;
	if (context.hs.readable()) {
		if (context.hs.c?.dns.magic_dns) {
			magic = context.hs.c.dns.base_domain;
		}
	}

	const stats = await context.agents?.lookup(nodes.map((node) => node.nodeKey));
	const populatedNodes = mapNodes(nodes, stats);

	return {
		populatedNodes,
		nodes,
		users,
		magic,
		server: context.config.headscale.url,
		publicServer: context.config.headscale.public_url,
		agent: context.agents?.agentID(),
		writable: writablePermission,
		preAuth: await context.sessions.check(
			request,
			Capabilities.generate_authkeys,
		),
		subject: user.subject,
	};
}

export async function action(request: ActionFunctionArgs) {
	return machineAction(request);
}

export default function Page() {
	const data = useLoaderData<typeof loader>();

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
					isDisabled={!data.writable}
					disabledKeys={data.preAuth ? [] : ['pre-auth']}
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
						{/* We only want to show the version column if there are agents */}
						{data.agent !== undefined ? (
							<th className="uppercase text-xs font-bold pb-2">Version</th>
						) : undefined}
						<th className="uppercase text-xs font-bold pb-2">Last Seen</th>
					</tr>
				</thead>
				<tbody
					className={cn(
						'divide-y divide-headplane-100 dark:divide-headplane-800 align-top',
						'border-t border-headplane-100 dark:border-headplane-800',
					)}
				>
					{data.populatedNodes.map((machine) => (
						<MachineRow
							key={machine.id}
							node={machine}
							users={data.users}
							magic={data.magic}
							isAgent={data.agent ? data.agent === machine.nodeKey : undefined}
							isDisabled={
								data.writable
									? false // If the user has write permissions, they can edit all machines
									: machine.user.providerId?.split('/').pop() !== data.subject
							}
						/>
					))}
				</tbody>
			</table>
		</>
	);
}
