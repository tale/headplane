import { GlobeLock, RouteOff } from 'lucide-react';
import { useMemo } from 'react';
import { useFetcher } from 'react-router';
import Dialog from '~/components/Dialog';
import Link from '~/components/Link';
import Switch from '~/components/Switch';
import TableList from '~/components/TableList';
import type { Machine, Route } from '~/types';
import cn from '~/utils/cn';

interface RoutesProps {
	machine: Machine;
	routes: Route[];
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
}

// TODO: Support deleting routes
export default function Routes({
	machine,
	routes,
	isOpen,
	setIsOpen,
}: RoutesProps) {
	const fetcher = useFetcher();

	// This is much easier with Object.groupBy but it's too new for us
	const { exit, subnet } = routes.reduce<{
		exit: Route[];
		subnet: Route[];
	}>(
		(acc, route) => {
			if (route.prefix === '::/0' || route.prefix === '0.0.0.0/0') {
				acc.exit.push(route);
				return acc;
			}

			acc.subnet.push(route);
			return acc;
		},
		{ exit: [], subnet: [] },
	);

	const exitEnabled = useMemo(() => {
		if (exit.length !== 2) return false;
		return exit[0].enabled && exit[1].enabled;
	}, [exit]);

	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel variant="unactionable">
				<Dialog.Title>Edit route settings of {machine.givenName}</Dialog.Title>
				<Dialog.Text className="font-bold">Subnet routes</Dialog.Text>
				<Dialog.Text>
					Connect to devices you can&apos;t install Tailscale on by advertising
					IP ranges as subnet routes.{' '}
					<Link
						to="https://tailscale.com/kb/1019/subnets"
						name="Tailscale Subnets Documentation"
					>
						Learn More
					</Link>
				</Dialog.Text>
				<TableList className="mt-4">
					{subnet.length === 0 ? (
						<TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
							<RouteOff />
							<p className="font-semibold">
								No routes are advertised by this machine
							</p>
						</TableList.Item>
					) : undefined}
					{subnet.map((route) => (
						<TableList.Item key={route.id}>
							<p>{route.prefix}</p>
							<Switch
								defaultSelected={route.enabled}
								label="Enabled"
								onChange={(checked) => {
									const form = new FormData();
									form.set('id', machine.id);
									form.set('_method', 'routes');
									form.set('route', route.id);

									form.set('enabled', String(checked));
									fetcher.submit(form, {
										method: 'POST',
									});
								}}
							/>
						</TableList.Item>
					))}
				</TableList>
				<Dialog.Text className="font-bold mt-8">Exit nodes</Dialog.Text>
				<Dialog.Text>
					Allow your network to route internet traffic through this machine.{' '}
					<Link
						to="https://tailscale.com/kb/1103/exit-nodes"
						name="Tailscale Exit-node Documentation"
					>
						Learn More
					</Link>
				</Dialog.Text>
				<TableList className="mt-4">
					{exit.length === 0 ? (
						<TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
							<GlobeLock />
							<p className="font-semibold">This machine is not an exit node</p>
						</TableList.Item>
					) : (
						<TableList.Item>
							<p>Use as exit node</p>
							<Switch
								defaultSelected={exitEnabled}
								label="Enabled"
								onChange={(checked) => {
									const form = new FormData();
									form.set('id', machine.id);
									form.set('_method', 'exit-node');
									form.set('routes', exit.map((route) => route.id).join(','));

									form.set('enabled', String(checked));
									fetcher.submit(form, {
										method: 'POST',
									});
								}}
							/>
						</TableList.Item>
					)}
				</TableList>
			</Dialog.Panel>
		</Dialog>
	);
}
