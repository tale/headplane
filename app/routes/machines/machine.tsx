import { CheckCircle, CircleSlash, Info, UserCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Link as RemixLink, useLoaderData } from 'react-router';
import Attribute from '~/components/Attribute';
import Button from '~/components/Button';
import Card from '~/components/Card';
import Chip from '~/components/Chip';
import Link from '~/components/Link';
import StatusCircle from '~/components/StatusCircle';
import Tooltip from '~/components/Tooltip';
import type { LoadContext } from '~/server';
import type { Machine, User } from '~/types';
import cn from '~/utils/cn';
import { getOSInfo, getTSVersion } from '~/utils/host-info';
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

	const [machine, { users }] = await Promise.all([
		context.client.get<{ node: Machine }>(
			`v1/node/${params.id}`,
			session.api_key,
		),
		context.client.get<{ users: User[] }>('v1/user', session.api_key),
	]);

	const lookup = await context.agents?.lookup([machine.node.nodeKey]);
	const [node] = mapNodes([machine.node], lookup);
	const tags = Array.from(
		new Set([...node.validTags, ...node.forcedTags]),
	).sort();

	return {
		node,
		tags,
		users,
		magic,
		agent: context.agents?.agentID(),
		stats: lookup?.[node.nodeKey],
	};
}

export async function action(request: ActionFunctionArgs) {
	return machineAction(request);
}

export default function Page() {
	const { node, tags, magic, users, agent, stats } =
		useLoaderData<typeof loader>();
	const [showRouting, setShowRouting] = useState(false);

	const uiTags = useMemo(() => {
		const tags = uiTagsForNode(node, agent === node.nodeKey);
		return tags;
	}, [node, agent]);

	return (
		<div>
			<p className="mb-8 text-md">
				<RemixLink className="font-medium" to="/machines">
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
					<StatusCircle className="w-4 h-4" isOnline={node.online} />
				</span>
				<MenuOptions isFullButton magic={magic} node={node} users={users} />
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
						{node.user.name ||
							node.user.displayName ||
							node.user.email ||
							node.user.id}
					</div>
				</div>
				<div className="p-2 pl-4">
					<p className="text-sm text-headplane-600 dark:text-headplane-300">
						Status
					</p>
					<div className="flex gap-1 mt-1 mb-8">
						{mapTagsToComponents(node, uiTags)}
						{tags.map((tag) => (
							<Chip key={tag} text={tag} />
						))}
					</div>
				</div>
			</div>
			<Routes isOpen={showRouting} node={node} setIsOpen={setShowRouting} />
			<h2 className="text-xl font-medium mt-8">Subnets & Routing</h2>
			<div className="flex items-center justify-between mb-4">
				<p>
					Subnets let you expose physical network routes onto Tailscale.{' '}
					<Link
						name="Tailscale Subnets Documentation"
						to="https://tailscale.com/kb/1019/subnets"
					>
						Learn More
					</Link>
				</p>
				<Button onPress={() => setShowRouting(true)}>Review</Button>
			</div>
			<Card
				className={cn(
					'w-full max-w-full grid sm:grid-cols-2',
					'md:grid-cols-4 gap-8 mr-2 text-sm mb-8',
				)}
				variant="flat"
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
									<li key={route}>{route}</li>
								))}
							</ul>
						)}
					</div>
					<Button
						className={cn(
							'px-1.5 py-0.5 rounded-md mt-1.5',
							'text-blue-500 dark:text-blue-400',
						)}
						onPress={() => setShowRouting(true)}
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
									<li key={route}>{route}</li>
								))}
							</ul>
						)}
					</div>
					<Button
						className={cn(
							'px-1.5 py-0.5 rounded-md mt-1.5',
							'text-blue-500 dark:text-blue-400',
						)}
						onPress={() => setShowRouting(true)}
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
						className={cn(
							'px-1.5 py-0.5 rounded-md mt-1.5',
							'text-blue-500 dark:text-blue-400',
						)}
						onPress={() => setShowRouting(true)}
					>
						Edit
					</Button>
				</div>
			</Card>
			<h2 className="text-xl font-medium">Machine Details</h2>
			<p className="mb-4">
				Information about this machine’s network. Used to debug connection
				issues.
			</p>
			<Card
				className="w-full max-w-full grid grid-cols-1 lg:grid-cols-2 gap-y-2 sm:gap-x-12"
				variant="flat"
			>
				<div className="flex flex-col gap-1">
					<Attribute
						name="Creator"
						value={
							node.user.name ||
							node.user.displayName ||
							node.user.email ||
							node.user.id
						}
					/>
					<Attribute name="Machine name" value={node.givenName} />
					<Attribute
						name="OS hostname"
						tooltip="OS hostname is published by the machine’s operating system and is used as the default name for the machine."
						value={node.name}
					/>
					{stats ? (
						<>
							<Attribute name="OS" value={getOSInfo(stats)} />
							<Attribute name="Tailscale version" value={getTSVersion(stats)} />
						</>
					) : undefined}
					<Attribute
						name="ID"
						tooltip="ID for this machine. Used in the Headscale API."
						value={node.id}
					/>
					<Attribute
						isCopyable
						name="Node key"
						tooltip="Public key which uniquely identifies this machine."
						value={node.nodeKey}
					/>
					<Attribute
						name="Created"
						value={new Date(node.createdAt).toLocaleString()}
					/>
					<Attribute
						name="Last Seen"
						value={
							node.online
								? 'Connected'
								: new Date(node.lastSeen).toLocaleString()
						}
					/>
					<Attribute
						name="Key expiry"
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
				</div>
				<div className="flex flex-col gap-1">
					<p className="uppercase text-sm font-semibold opacity-75">
						Addresses
					</p>
					<Attribute
						isCopyable
						name="Tailscale IPv4"
						tooltip="This machine’s IPv4 address within your tailnet (your private Tailscale network)."
						value={getIpv4Address(node.ipAddresses)}
					/>
					<Attribute
						isCopyable
						name="Tailscale IPv6"
						tooltip="This machine’s IPv6 address within your tailnet (your private Tailscale network). Connections within your tailnet support IPv6 even if your ISP does not."
						value={getIpv6Address(node.ipAddresses)}
					/>
					<Attribute
						isCopyable
						name="Short domain"
						tooltip="Users of your tailnet can use this DNS short name to access this machine."
						value={node.givenName}
					/>
					{magic ? (
						<Attribute
							isCopyable
							name="Full domain"
							tooltip="Users of your tailnet can use this DNS name to access this machine."
							value={`${node.givenName}.${magic}`}
						/>
					) : undefined}
					{stats ? (
						<>
							<p className="uppercase text-sm font-semibold opacity-75 mt-4">
								Client Connectivity
							</p>
							<Attribute
								name="Varies"
								tooltip="Whether the machine is behind a difficult NAT that varies the machine’s IP address depending on the destination."
								value={stats.NetInfo?.MappingVariesByDestIP ? 'Yes' : 'No'}
							/>
							<Attribute
								name="Hairpinning"
								tooltip="Whether the machine needs to traverse NATs with hairpinning."
								value={stats.NetInfo?.HairPinning ? 'Yes' : 'No'}
							/>
							<Attribute
								name="IPv6"
								value={stats.NetInfo?.WorkingIPv6 ? 'Yes' : 'No'}
							/>
							<Attribute
								name="UDP"
								value={stats.NetInfo?.WorkingUDP ? 'Yes' : 'No'}
							/>
							<Attribute
								name="UPnP"
								value={stats.NetInfo?.UPnP ? 'Yes' : 'No'}
							/>
							<Attribute name="PCP" value={stats.NetInfo?.PCP ? 'Yes' : 'No'} />
							<Attribute
								name="NAT-PMP"
								value={stats.NetInfo?.PMP ? 'Yes' : 'No'}
							/>
						</>
					) : undefined}
				</div>
			</Card>
		</div>
	);
}

function getIpv4Address(addresses: string[]) {
	for (const address of addresses) {
		if (address.startsWith('100.')) {
			// Return the first CGNAT address
			return address;
		}
	}

	return '—';
}

function getIpv6Address(addresses: string[]) {
	for (const address of addresses) {
		if (address.startsWith('fd')) {
			// Return the first IPv6 address
			return address;
		}
	}

	return '—';
}
