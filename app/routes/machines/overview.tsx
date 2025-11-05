import { Info } from 'lucide-react';
import Code from '~/components/Code';
import Link from '~/components/Link';
import Tooltip from '~/components/Tooltip';
import { Capabilities } from '~/server/web/roles';
import cn from '~/utils/cn';
import { mapNodes } from '~/utils/node-info';
import type { Route } from './+types/overview';
import MachineRow from './components/machine-row';
import NewMachine from './dialogs/new';
import { machineAction } from './machine-actions';

export async function loader({ request, context }: Route.LoaderArgs) {
	const session = await context.sessions.auth(request);
	const user = session.user;
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

	const api = context.hsApi.getRuntimeClient(session.api_key);
	const [nodes, users] = await Promise.all([api.getNodes(), api.getUsers()]);

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

export const action = machineAction;

export default function Page({ loaderData }: Route.ComponentProps) {
	return (
		<>
			<div className="flex justify-between items-center mb-6">
				<div className="flex flex-col w-2/3">
					<h1 className="text-2xl font-medium mb-2">Machines</h1>
					<p>
						Manage the devices connected to your Tailnet.{' '}
						<Link
							name="Tailscale Manage Devices Documentation"
							to="https://tailscale.com/kb/1372/manage-devices"
						>
							Learn more
						</Link>
					</p>
				</div>
				<NewMachine
					disabledKeys={loaderData.preAuth ? [] : ['pre-auth']}
					isDisabled={!loaderData.writable}
					server={loaderData.publicServer ?? loaderData.server}
					users={loaderData.users}
				/>
			</div>
			<table className="table-auto w-full rounded-lg">
				<thead className="text-headplane-600 dark:text-headplane-300">
					<tr className="text-left px-0.5">
						<th className="uppercase text-xs font-bold pb-2">Name</th>
						<th className="pb-2 w-1/4">
							<div className="flex items-center gap-x-1">
								<p className="uppercase text-xs font-bold">Addresses</p>
								{loaderData.magic ? (
									<Tooltip>
										<Info className="w-4 h-4" />
										<Tooltip.Body className="font-normal">
											Since MagicDNS is enabled, you can access devices based on
											their name and also at{' '}
											<Code>
												[name].
												{loaderData.magic}
											</Code>
										</Tooltip.Body>
									</Tooltip>
								) : undefined}
							</div>
						</th>
						{/* We only want to show the version column if there are agents */}
						{loaderData.agent !== undefined ? (
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
					{loaderData.populatedNodes.map((node) => (
						<MachineRow
							isAgent={
								loaderData.agent ? loaderData.agent === node.nodeKey : undefined
							}
							isDisabled={
								loaderData.writable
									? false // If the user has write permissions, they can edit all machines
									: node.user.providerId?.split('/').pop() !==
										loaderData.subject
							}
							key={node.id}
							magic={loaderData.magic}
							node={node}
							users={loaderData.users}
						/>
					))}
				</tbody>
			</table>
		</>
	);
}
