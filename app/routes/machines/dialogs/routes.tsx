import { useMemo } from 'react';
import { useFetcher } from 'react-router';
import Dialog from '~/components/Dialog';
import Link from '~/components/Link';
import Switch from '~/components/Switch';
import type { Machine, Route } from '~/types';
import { cn } from '~/utils/cn';

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
				<div
					className={cn(
						'rounded-lg overflow-y-auto my-2',
						'divide-y divide-zinc-200 dark:divide-zinc-700 align-top',
						'border border-zinc-200 dark:border-zinc-700',
					)}
				>
					{subnet.length === 0 ? (
						<div
							className={cn(
								'flex py-4 px-4 bg-ui-100 dark:bg-ui-800',
								'items-center justify-center',
								'text-ui-600 dark:text-ui-300',
							)}
						>
							<p>No routes are advertised on this machine.</p>
						</div>
					) : undefined}
					{subnet.map((route) => (
						<div
							key={route.id}
							className={cn(
								'flex py-2 px-4 bg-ui-100 dark:bg-ui-800',
								'items-center justify-between',
							)}
						>
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
						</div>
					))}
				</div>
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
				<div
					className={cn(
						'rounded-lg overflow-y-auto my-2',
						'divide-y divide-zinc-200 dark:divide-zinc-700 align-top',
						'border border-zinc-200 dark:border-zinc-700',
					)}
				>
					{exit.length === 0 ? (
						<div
							className={cn(
								'flex py-4 px-4 bg-ui-100 dark:bg-ui-800',
								'items-center justify-center',
								'text-ui-600 dark:text-ui-300',
							)}
						>
							<p>This machine is not an exit node.</p>
						</div>
					) : (
						<div
							className={cn(
								'flex py-2 px-4 bg-ui-100 dark:bg-ui-800',
								'items-center justify-between',
							)}
						>
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
						</div>
					)}
				</div>
			</Dialog.Panel>
		</Dialog>
	);
}
