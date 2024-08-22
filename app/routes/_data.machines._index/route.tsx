/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { InfoIcon } from '@primer/octicons-react'
import { type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components'

import Code from '~/components/Code'
import { type Machine, type Route, User } from '~/types'
import { cn } from '~/utils/cn'
import { loadContext } from '~/utils/config/headplane'
import { loadConfig } from '~/utils/config/headscale'
import { pull } from '~/utils/headscale'
import { getSession } from '~/utils/sessions'
import { useLiveData } from '~/utils/useLiveData'

import { menuAction } from './action'
import MachineRow from './machine'

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	const [machines, routes, users] = await Promise.all([
		pull<{ nodes: Machine[] }>('v1/node', session.get('hsApiKey')!),
		pull<{ routes: Route[] }>('v1/routes', session.get('hsApiKey')!),
		pull<{ users: User[] }>('v1/user', session.get('hsApiKey')!),
	])

	const context = await loadContext()
	let magic: string | undefined

	if (context.config.read) {
		const config = await loadConfig()
		if (config.dns.magic_dns) {
			magic = config.dns.base_domain
		}
	}

	return {
		nodes: machines.nodes,
		routes: routes.routes,
		users: users.users,
		magic,
	}
}

export async function action({ request }: ActionFunctionArgs) {
	return menuAction(request)
}

export default function Page() {
	useLiveData({ interval: 3000 })
	const data = useLoaderData<typeof loader>()

	return (
		<>
			<h1 className="text-2xl font-medium mb-4">Machines</h1>
			<table className="table-auto w-full rounded-lg">
				<thead className="text-gray-500 dark:text-gray-400">
					<tr className="text-left uppercase text-xs font-bold px-0.5">
						<th className="pb-2">Name</th>
						<th className="pb-2">
							<div className="flex items-center gap-x-1">
								Addresses
								{data.magic
									? (
										<TooltipTrigger delay={0}>
											<Button>
												<InfoIcon className="w-4 h-4" />
											</Button>
											<Tooltip className={cn(
												'text-sm max-w-xs p-2 rounded-lg mb-2',
												'bg-white dark:bg-zinc-800',
												'border border-gray-200 dark:border-zinc-700',
											)}
											>
												Since MagicDNS is enabled, you can access devices
												based on their name and also at
												{' '}
												<Code>
													[name].[user].
													{data.magic}
												</Code>
											</Tooltip>
										</TooltipTrigger>
										)
									: undefined}
							</div>
						</th>
						<th className="pb-2">Last Seen</th>
					</tr>
				</thead>
				<tbody className={cn(
					'divide-y divide-zinc-200 dark:divide-zinc-700 align-top',
					'border-t border-zinc-200 dark:border-zinc-700',
				)}
				>
					{data.nodes.map(machine => (
						<MachineRow
							key={machine.id}
							machine={machine}
							routes={data.routes.filter(route => route.node.id === machine.id)}
							users={data.users}
							magic={data.magic}
						/>
					))}
				</tbody>
			</table>
		</>
	)
}
