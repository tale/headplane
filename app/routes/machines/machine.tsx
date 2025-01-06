import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Link as RemixLink, useLoaderData } from 'react-router';
import {
	InfoIcon,
	GearIcon,
	CheckCircleIcon,
	SkipIcon,
	PersonIcon,
} from '@primer/octicons-react';
import { useMemo, useState } from 'react';

import Attribute from '~/components/Attribute';
import Button from '~/components/Button';
import Card from '~/components/Card';
import Menu from '~/components/Menu';
import Tooltip from '~/components/Tooltip';
import StatusCircle from '~/components/StatusCircle';
import type { Machine, Route, User } from '~/types';
import { cn } from '~/utils/cn';
import { loadContext } from '~/utils/config/headplane';
import { loadConfig } from '~/utils/config/headscale';
import { pull } from '~/utils/headscale';
import { getSession } from '~/utils/sessions.server';
import { useLiveData } from '~/utils/useLiveData';
import Link from '~/components/Link';

import { menuAction } from './action';
import MenuOptions from './components/menu';
import Routes from './dialogs/routes';

export async function loader({ request, params }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	if (!params.id) {
		throw new Error('No machine ID provided');
	}

	const context = await loadContext();
	let magic: string | undefined;

	if (context.config.read) {
		const config = await loadConfig();
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
	};
}

export async function action({ request }: ActionFunctionArgs) {
	return menuAction(request);
}

export default function Page() {
	const { machine, magic, routes, users } = useLoaderData<typeof loader>();
	const routesState = useState(false);
	useLiveData({ interval: 1000 });

	const expired =
		machine.expiry === '0001-01-01 00:00:00' ||
		machine.expiry === '0001-01-01T00:00:00Z' ||
		machine.expiry === null
			? false
			: new Date(machine.expiry).getTime() < Date.now();

	const tags = [...machine.forcedTags, ...machine.validTags];

	if (expired) {
		tags.unshift('Expired');
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
					'flex justify-between items-center',
					'border-b border-ui-100 dark:border-ui-800',
				)}
			>
				<span className="flex items-baseline gap-x-4 text-sm mb-4">
					<h1 className="text-2xl font-medium">{machine.givenName}</h1>
					<StatusCircle isOnline={machine.online} className="w-4 h-4" />
				</span>

				<MenuOptions
					machine={machine}
					routes={routes}
					users={users}
					magic={magic}
					buttonChild={
						<Menu.Button
							className={cn(
								'flex items-center justify-center gap-x-2',
								'bg-main-200 dark:bg-main-700/30',
								'hover:bg-main-300 dark:hover:bg-main-600/30',
								'text-ui-700 dark:text-ui-300 mb-2',
								'w-fit text-sm rounded-lg px-3 py-2',
							)}
						>
							<GearIcon className="w-5" />
							Machine Settings
						</Menu.Button>
					}
				/>
			</div>
			<div className="flex gap-1 mb-4">
				<div className="border-r border-ui-100 dark:border-ui-800 p-2 pr-4">
					<span className="text-sm text-ui-600 dark:text-ui-300 flex items-center gap-x-1">
						Managed by
						<Tooltip>
							<Tooltip.Button>
								<InfoIcon className="w-3.5 h-3.5" />
							</Tooltip.Button>
							<Tooltip.Body>
								By default, a machine’s permissions match its creator’s.
							</Tooltip.Body>
						</Tooltip>
					</span>
					<div className="flex items-center gap-x-2.5 mt-1">
						<div
							className={cn(
								'rounded-full h-7 w-7 flex items-center justify-center',
								'border border-ui-200 dark:border-ui-700',
							)}
						>
							<PersonIcon className="w-4 h-4" />
						</div>
						{machine.user.name}
					</div>
				</div>
				<div className="p-2 pl-4">
					<p className="text-sm text-ui-600 dark:text-ui-300">Status</p>
					<div className="flex gap-1 mt-1 mb-8">
						{tags.map((tag) => (
							<span
								key={tag}
								className={cn(
									'text-xs rounded-md px-1.5 py-0.5',
									'bg-ui-200 dark:bg-ui-800',
									'text-ui-600 dark:text-ui-300',
								)}
							>
								{tag}
							</span>
						))}
					</div>
				</div>
			</div>
			<h2 className="text-xl font-medium mb-4 mt-8">Subnets & Routing</h2>
			<Routes machine={machine} routes={routes} state={routesState} />
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
				<Button variant="light" control={routesState}>
					Review
				</Button>
			</div>
			<Card
				variant="flat"
				className={cn(
					'w-full max-w-full grid sm:grid-cols-2',
					'md:grid-cols-4 gap-8 mr-2 text-sm mb-8',
				)}
			>
				<div>
					<span className="text-ui-600 dark:text-ui-300 flex items-center gap-x-1">
						Approved
						<Tooltip>
							<Tooltip.Button>
								<InfoIcon className="w-3.5 h-3.5" />
							</Tooltip.Button>
							<Tooltip.Body>
								Traffic to these routes are being routed through this machine.
							</Tooltip.Body>
						</Tooltip>
					</span>
					<div className="mt-1">
						{subnetApproved.length === 0 ? (
							<span className="text-ui-400 dark:text-ui-300">—</span>
						) : (
							<ul className="leading-normal">
								{subnetApproved.map((route) => (
									<li key={route.id}>{route.prefix}</li>
								))}
							</ul>
						)}
					</div>
					<Button
						className={cn(
							'p-0 rounded-sm bg-transparent mt-1',
							'text-blue-500 dark:text-blue-400',
							'hover:bg-transparent',
							'hover:text-blue-600 dark:hover:text-blue-500',
						)}
						control={routesState}
					>
						Edit
					</Button>
				</div>
				<div>
					<span className="text-ui-600 dark:text-ui-300 flex items-center gap-x-1">
						Awaiting Approval
						<Tooltip>
							<Tooltip.Button>
								<InfoIcon className="w-3.5 h-3.5" />
							</Tooltip.Button>
							<Tooltip.Body>
								This machine is advertising these routes, but they must be
								approved before traffic will be routed to them.
							</Tooltip.Body>
						</Tooltip>
					</span>
					<div className="mt-1">
						{subnet.length === 0 ? (
							<span className="text-ui-400 dark:text-ui-300">—</span>
						) : (
							<ul className="leading-normal">
								{subnet.map((route) => (
									<li key={route.id}>{route.prefix}</li>
								))}
							</ul>
						)}
					</div>
					<Button
						className={cn(
							'p-0 rounded-sm bg-transparent mt-1',
							'text-blue-500 dark:text-blue-400',
							'hover:bg-transparent',
							'hover:text-blue-600 dark:hover:text-blue-500',
						)}
						control={routesState}
					>
						Edit
					</Button>
				</div>
				<div>
					<span className="text-ui-600 dark:text-ui-300 flex items-center gap-x-1">
						Exit Node
						<Tooltip>
							<Tooltip.Button>
								<InfoIcon className="w-3.5 h-3.5" />
							</Tooltip.Button>
							<Tooltip.Body>
								Whether this machine can act as an exit node for your tailnet.
							</Tooltip.Body>
						</Tooltip>
					</span>
					<div className="mt-1">
						{exit.length === 0 ? (
							<span className="text-ui-400 dark:text-ui-300">—</span>
						) : exitEnabled ? (
							<span className="flex items-center gap-x-1">
								<CheckCircleIcon className="w-3.5 h-3.5 text-green-700" />
								Allowed
							</span>
						) : (
							<span className="flex items-center gap-x-1">
								<SkipIcon className="w-3.5 h-3.5 text-red-700" />
								Awaiting Approval
							</span>
						)}
					</div>
					<Button
						className={cn(
							'p-0 rounded-sm bg-transparent mt-1',
							'text-blue-500 dark:text-blue-400',
							'hover:bg-transparent',
							'hover:text-blue-600 dark:hover:text-blue-500',
						)}
						control={routesState}
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
