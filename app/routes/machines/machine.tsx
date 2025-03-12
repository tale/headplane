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
import type { Machine, Route, User } from '~/types';
import cn from '~/utils/cn';
import { hs_getConfig } from '~/utils/config/loader';
import { pull } from '~/utils/headscale';
import { getSession } from '~/utils/sessions.server';
import type { AppContext } from '~server/context/app';
import { menuAction } from './action';
import MenuOptions from './components/menu';
import Routes from './dialogs/routes';

export async function loader({
	request,
	params,
	context,
}: LoaderFunctionArgs<AppContext>) {
	const session = await getSession(request.headers.get('Cookie'));
	if (!params.id) {
		throw new Error('No machine ID provided');
	}

	const { mode, config } = hs_getConfig();
	let magic: string | undefined;

	if (mode !== 'no') {
		if (config.dns.magic_dns) {
			magic = config.dns.base_domain;
		}
	}

	const [machine, routes, users] = await Promise.all([
		pull<{ node: Machine }>(`v1/node/${params.id}`, session.get('hsApiKey')!),
		pull<{ routes: Route[] }>('v1/routes', session.get('hsApiKey')!),
		pull<{ users: User[] }>('v1/user', session.get('hsApiKey')!),
	]);

	return {
		machine: machine.node,
		routes: routes.routes.filter((route) => route.node.id === params.id),
		users: users.users,
		magic,
		agent: context?.agents.includes(machine.node.id),
	};
}

export async function action({ request }: ActionFunctionArgs) {
	return menuAction(request);
}

export default function Page() {
	const { machine, magic, routes, users, agent } =
		useLoaderData<typeof loader>();
	const [showRouting, setShowRouting] = useState(false);
	console.log(machine.expiry);

	const expired =
		machine.expiry === '0001-01-01 00:00:00' ||
		machine.expiry === '0001-01-01T00:00:00Z' ||
		machine.expiry === null
			? false
			: new Date(machine.expiry).getTime() < Date.now();

	const tags = [...new Set([...machine.forcedTags, ...machine.validTags])];

	if (expired) {
		tags.unshift('Expired');
	}

	if (agent) {
		tags.unshift('Headplane Agent');
	}

	// This is much easier with Object.groupBy but it's too new for us
	const { exit, subnet, subnetApproved } = routes.reduce<{
		exit: Route[];
		subnet: Route[];
		subnetApproved: Route[];
	}>(
		(acc, route) => {
			if (route.prefix === '::/0' || route.prefix === '0.0.0.0/0') {
				acc.exit.push(route);
				return acc;
			}

			if (route.enabled) {
				acc.subnetApproved.push(route);
				return acc;
			}

			acc.subnet.push(route);
			return acc;
		},
		{ exit: [], subnetApproved: [], subnet: [] },
	);

	const exitEnabled = useMemo(() => {
		if (exit.length !== 2) return false;
		return exit[0].enabled && exit[1].enabled;
	}, [exit]);

	if (exitEnabled) {
		tags.unshift('Exit Node');
	}

	if (subnetApproved.length > 0) {
		tags.unshift('Subnets');
	}

	return (
		<div>
			<p className="mb-8 text-md">
				<RemixLink to="/machines" className="font-medium">
					All Machines
				</RemixLink>
				<span className="mx-2">/</span>
				{machine.givenName}
			</p>
			<div
				className={cn(
					'flex justify-between items-center pb-2',
					'border-b border-headplane-100 dark:border-headplane-800',
				)}
			>
				<span className="flex items-baseline gap-x-4 text-sm">
					<h1 className="text-2xl font-medium">{machine.givenName}</h1>
					<StatusCircle isOnline={machine.online} className="w-4 h-4" />
				</span>

				<MenuOptions
					isFullButton
					machine={machine}
					routes={routes}
					users={users}
					magic={magic}
				/>
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
						{machine.user.name}
					</div>
				</div>
				{tags.length > 0 ? (
					<div className="p-2 pl-4">
						<p className="text-sm text-headplane-600 dark:text-headplane-300">
							Status
						</p>
						<div className="flex gap-1 mt-1 mb-8">
							{tags.map((tag) => (
								<Chip key={tag} text={tag} />
							))}
						</div>
					</div>
				) : undefined}
			</div>
			<h2 className="text-xl font-medium mb-4 mt-8">Subnets & Routing</h2>
			<Routes
				machine={machine}
				routes={routes}
				isOpen={showRouting}
				setIsOpen={setShowRouting}
			/>
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
						{subnetApproved.length === 0 ? (
							<span className="opacity-50">—</span>
						) : (
							<ul className="leading-normal">
								{subnetApproved.map((route) => (
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
						{subnet.length === 0 ? (
							<span className="opacity-50">—</span>
						) : (
							<ul className="leading-normal">
								{subnet.map((route) => (
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
						{exit.length === 0 ? (
							<span className="opacity-50">—</span>
						) : exitEnabled ? (
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
				<Attribute name="Creator" value={machine.user.name} />
				<Attribute name="Node ID" value={machine.id} />
				<Attribute name="Node Name" value={machine.givenName} />
				<Attribute name="Hostname" value={machine.name} />
				<Attribute isCopyable name="Node Key" value={machine.nodeKey} />
				<Attribute
					name="Created"
					value={new Date(machine.createdAt).toLocaleString()}
				/>
				<Attribute
					name="Last Seen"
					value={new Date(machine.lastSeen).toLocaleString()}
				/>
				<Attribute
					name="Expiry"
					value={expired ? new Date(machine.expiry).toLocaleString() : 'Never'}
				/>
				{magic ? (
					<Attribute
						isCopyable
						name="Domain"
						value={`${machine.givenName}.${magic}`}
					/>
				) : undefined}
			</Card>
		</div>
	);
}
