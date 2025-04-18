import { CheckCircle, CircleSlash, Info, UserCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Link as RemixLink, useLoaderData } from 'react-router';
import { mapTag } from 'yaml/util';
import Attribute from '~/components/Attribute';
import Button from '~/components/Button';
import Card from '~/components/Card';
import Chip from '~/components/Chip';
import Link from '~/components/Link';
import StatusCircle from '~/components/StatusCircle';
import Tooltip from '~/components/Tooltip';
import type { LoadContext } from '~/server';
import type { Machine, Route, User } from '~/types';
import cn from '~/utils/cn';
import { mapNodes } from '~/utils/node-info';
import { mapTagsToComponents, uiTagsForNode } from './components/machine-row';
import MenuOptions from './components/menu';
import Routes from './dialogs/routes';
import { machineAction } from './machine-actions';

export async function loader({
	request,
	params,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	const session = await context.sessions.auth(request);
	if (!params.id) {
		throw new Error('No machine ID provided');
	}

	let magic: string | undefined;
	if (context.hs.readable()) {
		if (context.hs.c?.dns.magic_dns) {
			magic = context.hs.c.dns.base_domain;
		}
	}

	const [machine, { routes }, { users }] = await Promise.all([
		context.client.get<{ node: Machine }>(
			`v1/node/${params.id}`,
			session.get('api_key')!,
		),
		context.client.get<{ routes: Route[] }>(
			'v1/routes',
			session.get('api_key')!,
		),
		context.client.get<{ users: User[] }>('v1/user', session.get('api_key')!),
	]);

	const [node] = mapNodes([machine.node], routes);

	return {
		node,
		users,
		magic,
		agent: context.agents?.agentID(),
	};
}

export async function action(request: ActionFunctionArgs) {
	return machineAction(request);
}

export default function Page() {
	const { node, magic, users, agent } = useLoaderData<typeof loader>();
	const [showRouting, setShowRouting] = useState(false);

	const uiTags = useMemo(() => {
		const tags = uiTagsForNode(node, agent === node.nodeKey);
		return tags;
	}, [node, agent]);

	return (
		<div>
			<p className="mb-8 text-md">
				<RemixLink to="/machines" className="font-medium">
					All Machines
				</RemixLink>
				<span className="mx-2">/</span>
				{node.givenName}
			</p>
			<div
				className={cn(
					'flex justify-between items-center pb-2',
					'border-b border-headplane-100 dark:border-headplane-800',
				)}
			>
				<span className="flex items-baseline gap-x-4 text-sm">
					<h1 className="text-2xl font-medium">{node.givenName}</h1>
					<StatusCircle isOnline={node.online} className="w-4 h-4" />
				</span>
				<MenuOptions isFullButton node={node} users={users} magic={magic} />
			</div>
			<div className="flex gap-1 mb-4">
				<div className="border-r border-headplane-100 dark:border-headplane-800 p-2 pr-4">
					<span className="text-sm text-headplane-600 dark:text-headplane-300 flex items-center gap-x-1">
						Managed by
						<Tooltip>
							<Info className="p-1" />
							<Tooltip.Body>
								By default, a machine’s permissions match its creator’s.
							</Tooltip.Body>
						</Tooltip>
					</span>
					<div className="flex items-center gap-x-2.5 mt-1">
						<UserCircle />
						{node.user.name}
					</div>
				</div>
				<div className="p-2 pl-4">
					<p className="text-sm text-headplane-600 dark:text-headplane-300">
						Status
					</p>
					<div className="flex gap-1 mt-1 mb-8">
						{mapTagsToComponents(node, uiTags)}
						{node.validTags.map((tag) => (
							<Chip key={tag} text={tag} />
						))}
					</div>
				</div>
			</div>
			<h2 className="text-xl font-medium mb-4 mt-8">Subnets & Routing</h2>
			<Routes node={node} isOpen={showRouting} setIsOpen={setShowRouting} />
			<div className="flex items-center justify-between mb-4">
				<p>
					Subnets let you expose physical network routes onto Tailscale.{' '}
					<Link
						to="https://tailscale.com/kb/1019/subnets"
						name="Tailscale Subnets Documentation"
					>
						Learn More
					</Link>
				</p>
				<Button onPress={() => setShowRouting(true)}>Review</Button>
			</div>
			<Card
				variant="flat"
				className={cn(
					'w-full max-w-full grid sm:grid-cols-2',
					'md:grid-cols-4 gap-8 mr-2 text-sm mb-8',
				)}
			>
				<div>
					<span className="text-headplane-600 dark:text-headplane-300 flex items-center gap-x-1">
						Approved
						<Tooltip>
							<Info className="w-3.5 h-3.5" />
							<Tooltip.Body>
								Traffic to these routes are being routed through this machine.
							</Tooltip.Body>
						</Tooltip>
					</span>
					<div className="mt-1">
						{node.customRouting.subnetApprovedRoutes.length === 0 ? (
							<span className="opacity-50">—</span>
						) : (
							<ul className="leading-normal">
								{node.customRouting.subnetApprovedRoutes.map((route) => (
									<li key={route.id}>{route.prefix}</li>
								))}
							</ul>
						)}
					</div>
					<Button
						onPress={() => setShowRouting(true)}
						className={cn(
							'px-1.5 py-0.5 rounded-md mt-1.5',
							'text-blue-500 dark:text-blue-400',
						)}
					>
						Edit
					</Button>
				</div>
				<div>
					<span className="text-headplane-600 dark:text-headplane-300 flex items-center gap-x-1">
						Awaiting Approval
						<Tooltip>
							<Info className="w-3.5 h-3.5" />
							<Tooltip.Body>
								This machine is advertising these routes, but they must be
								approved before traffic will be routed to them.
							</Tooltip.Body>
						</Tooltip>
					</span>
					<div className="mt-1">
						{node.customRouting.subnetWaitingRoutes.length === 0 ? (
							<span className="opacity-50">—</span>
						) : (
							<ul className="leading-normal">
								{node.customRouting.subnetWaitingRoutes.map((route) => (
									<li key={route.id}>{route.prefix}</li>
								))}
							</ul>
						)}
					</div>
					<Button
						onPress={() => setShowRouting(true)}
						className={cn(
							'px-1.5 py-0.5 rounded-md mt-1.5',
							'text-blue-500 dark:text-blue-400',
						)}
					>
						Edit
					</Button>
				</div>
				<div>
					<span className="text-headplane-600 dark:text-headplane-300 flex items-center gap-x-1">
						Exit Node
						<Tooltip>
							<Info className="w-3.5 h-3.5" />
							<Tooltip.Body>
								Whether this machine can act as an exit node for your tailnet.
							</Tooltip.Body>
						</Tooltip>
					</span>
					<div className="mt-1">
						{node.customRouting.exitRoutes.length === 0 ? (
							<span className="opacity-50">—</span>
						) : node.customRouting.exitApproved ? (
							<span className="flex items-center gap-x-1">
								<CheckCircle className="w-3.5 h-3.5 text-green-700" />
								Allowed
							</span>
						) : (
							<span className="flex items-center gap-x-1">
								<CircleSlash className="w-3.5 h-3.5 text-red-700" />
								Awaiting Approval
							</span>
						)}
					</div>
					<Button
						onPress={() => setShowRouting(true)}
						className={cn(
							'px-1.5 py-0.5 rounded-md mt-1.5',
							'text-blue-500 dark:text-blue-400',
						)}
					>
						Edit
					</Button>
				</div>
			</Card>
			<h2 className="text-xl font-medium mb-4">Machine Details</h2>
			<Card variant="flat" className="w-full max-w-full">
				<Attribute name="Creator" value={node.user.name} />
				<Attribute name="Node ID" value={node.id} />
				<Attribute name="Node Name" value={node.givenName} />
				<Attribute name="Hostname" value={node.name} />
				<Attribute isCopyable name="Node Key" value={node.nodeKey} />
				<Attribute
					suppressHydrationWarning
					name="Created"
					value={new Date(node.createdAt).toLocaleString()}
				/>
				<Attribute
					suppressHydrationWarning
					name="Last Seen"
					value={new Date(node.lastSeen).toLocaleString()}
				/>
				<Attribute
					suppressHydrationWarning
					name="Expiry"
					value={
						node.expiry !== null
							? new Date(node.expiry).toLocaleString()
							: 'Never'
					}
				/>
				{magic ? (
					<Attribute
						isCopyable
						name="Domain"
						value={`${node.givenName}.${magic}`}
					/>
				) : undefined}
			</Card>
		</div>
	);
}
