/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'

import Attribute from '~/components/Attribute'
import Card from '~/components/Card'
import StatusCircle from '~/components/StatusCircle'
import { Machine, Route, User } from '~/types'
import { cn } from '~/utils/cn'
import { loadContext } from '~/utils/config/headplane'
import { loadConfig } from '~/utils/config/headscale'
import { pull } from '~/utils/headscale'
import { getSession } from '~/utils/sessions'
import { useLiveData } from '~/utils/useLiveData'

import { menuAction } from './_data.machines._index/action'
import MenuOptions from './_data.machines._index/menu'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	if (!params.id) {
		throw new Error('No machine ID provided')
	}

	const context = await loadContext()
	let magic: string | undefined

	if (context.config.read) {
		const config = await loadConfig()
		if (config.dns.magic_dns) {
			magic = config.dns.base_domain
		}
	}

	const [machine, routes, users] = await Promise.all([
		pull<{ node: Machine }>(`v1/node/${params.id}`, session.get('hsApiKey')!),
		pull<{ routes: Route[] }>('v1/routes', session.get('hsApiKey')!),
		pull<{ users: User[] }>('v1/user', session.get('hsApiKey')!),
	])

	return {
		machine: machine.node,
		routes: routes.routes.filter(route => route.node.id === params.id),
		users: users.users,
		magic,
	}
}

export async function action({ request }: ActionFunctionArgs) {
	return menuAction(request)
}

export default function Page() {
	const { machine, magic, routes, users } = useLoaderData<typeof loader>()
	useLiveData({ interval: 1000 })

	const expired = machine.expiry === '0001-01-01 00:00:00'
		|| machine.expiry === '0001-01-01T00:00:00Z'
		? false
		: new Date(machine.expiry).getTime() < Date.now()

	const tags = [
		...machine.forcedTags,
		...machine.validTags,
	]

	if (expired) {
		tags.unshift('Expired')
	}

	return (
		<div>
			<p className="mb-8 text-md">
				<Link
					to="/machines"
					className="font-medium"
				>
					All Machines
				</Link>
				<span className="mx-2">
					/
				</span>
				{machine.givenName}
			</p>
			<div className="flex justify-between items-center">
				<span className="flex items-baseline gap-x-4 text-sm mb-4">
					<h1 className="text-2xl font-medium">
						{machine.givenName}
					</h1>
					<StatusCircle isOnline={machine.online} className="w-4 h-4" />
				</span>

				<MenuOptions
					machine={machine}
					routes={routes}
					users={users}
					magic={magic}
				/>
			</div>
			<div className="flex gap-1 mt-1 mb-8">
				{tags.map(tag => (
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
			<h2 className="text-xl font-medium mb-4">
				Machine Details
			</h2>
			<Card variant="flat" className="w-full max-w-full">
				<Attribute name="Creator" value={machine.user.name} />
				<Attribute name="Node ID" value={machine.id} />
				<Attribute name="Node Name" value={machine.givenName} />
				<Attribute name="Hostname" value={machine.name} />
				<Attribute
					isCopyable
					name="Node Key"
					value={machine.nodeKey}
				/>
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
					value={new Date(machine.expiry).toLocaleString()}
				/>
				{magic
					? (
						<Attribute
							isCopyable
							name="Domain"
							value={`${machine.givenName}.${magic}`}
						/>
						)
					: undefined}
			</Card>
			<h2 className="text-xl font-medium mb-4 mt-8">
				Machine Routes
			</h2>
			<Card variant="flat" className="w-full max-w-full">
				{routes.length === 0
					? (
						<div
							className={cn(
								'flex py-4 px-4',
								'items-center justify-center',
								'text-ui-600 dark:text-ui-300',
							)}
						>
							<p>
								No routes are advertised on this machine.
							</p>
						</div>
						)
					: routes.map((route, i) => (
						<div
							key={route.id}
							className={cn(
								'flex items-center justify-between',
								routes.length - 1 === i ? 'border-b pb-3 mb-2' : '',
								'border-ui-100 dark:border-ui-800',
							)}
						>
							<div>
								<p className="font-mono mb-1">
									{route.prefix}
								</p>
								<p className="text-sm text-ui-600 dark:text-ui-300">
									{' '}
									(Created:
									{' '}
									{new Date(route.createdAt).toLocaleString()}
									)
								</p>
							</div>
							<div className="text-right">
								<p className="mb-1">
									{route.enabled ? 'Enabled' : 'Disabled'}
								</p>
								<p className="text-sm text-ui-600 dark:text-ui-300">
									{route.isPrimary ? 'Primary' : 'Secondary'}
								</p>
							</div>
						</div>
					))}
			</Card>
		</div>
	)
}
