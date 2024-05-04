/* eslint-disable react/hook-use-state */
import { ChevronDownIcon, CopyIcon, KebabHorizontalIcon } from '@primer/octicons-react'
import { type FetcherWithComponents, Link } from '@remix-run/react'
import { useState } from 'react'

import Menu from '~/components/Menu'
import StatusCircle from '~/components/StatusCircle'
import { toast } from '~/components/Toaster'
import { type Machine, type Route } from '~/types'
import { cn } from '~/utils/cn'

import Delete from './dialogs/delete'
import Expire from './dialogs/expire'
import Rename from './dialogs/rename'
import Routes from './dialogs/routes'

type MachineProperties = {
	readonly machine: Machine;
	readonly routes: Route[];
	readonly fetcher: FetcherWithComponents<unknown>;
	readonly magic?: string;
}

export default function MachineRow({ machine, routes, fetcher, magic }: MachineProperties) {
	const renameState = useState(false)
	const expireState = useState(false)
	const removeState = useState(false)
	const routesState = useState(false)

	const expired = new Date(machine.expiry).getTime() < Date.now()
	const tags = [
		...machine.forcedTags,
		...machine.validTags
	]

	if (expired) {
		tags.unshift('Expired')
	}

	return (
		<tr
			key={machine.id}
			className='hover:bg-zinc-100 dark:hover:bg-zinc-800 group'
		>
			<td className='pl-0.5 py-2'>
				<Link
					to={`/machines/${machine.id}`}
					className='group/link h-full'
				>
					<p className={cn(
						'font-semibold leading-snug',
						'group-hover/link:text-blue-600',
						'group-hover/link:dark:text-blue-400'
					)}
					>
						{machine.givenName}
					</p>
					<p className='text-sm text-gray-500 dark:text-gray-300 font-mono'>
						{machine.name}
					</p>
					<div className='flex gap-1 mt-1'>
						{tags.map(tag => (
							<span
								key={tag}
								className={cn(
									'text-xs rounded-sm px-1 py-0.5',
									'bg-gray-100 dark:bg-zinc-700',
									'text-gray-600 dark:text-gray-300'
								)}
							>
								{tag}
							</span>
						))}
					</div>
				</Link>
			</td>
			<td className='py-2'>
				<div className='flex items-center gap-x-1'>
					{machine.ipAddresses[0]}
					<Menu>
						<Menu.Button>
							<ChevronDownIcon className='w-4 h-4'/>
						</Menu.Button>
						<Menu.Items>
							{machine.ipAddresses.map(ip => (
								<Menu.ItemButton
									key={ip}
									type='button'
									className={cn(
										'flex items-center gap-x-1.5 text-sm',
										'justify-between w-full'
									)}
									onPress={async () => {
										await navigator.clipboard.writeText(ip)
										toast('Copied IP address to clipboard')
									}}
								>
									{ip}
									<CopyIcon className='w-3 h-3'/>
								</Menu.ItemButton>
							))}
							{magic ? (
								<Menu.ItemButton
									type='button'
									className={cn(
										'flex items-center gap-x-1.5 text-sm',
										'justify-between w-full break-keep'
									)}
									onPress={async () => {
										const ip = `${machine.givenName}.${machine.user.name}.${magic}`
										await navigator.clipboard.writeText(ip)
										toast('Copied hostname to clipboard')
									}}
								>
									{machine.givenName}.{machine.user.name}.{magic}
									<CopyIcon className='w-3 h-3'/>
								</Menu.ItemButton>
							) : undefined}
						</Menu.Items>
					</Menu>
				</div>
			</td>
			<td className='py-2'>
				<span className={cn(
					'flex items-center gap-x-1 text-sm',
					'text-gray-500 dark:text-gray-400'
				)}
				>
					<StatusCircle
						isOnline={machine.online && !expired}
						className='w-4 h-4'
					/>
					<p>
						{machine.online && !expired
							? 'Connected'
							: new Date(
								machine.lastSeen
							).toLocaleString()}
					</p>
				</span>
			</td>
			<td className='py-2 pr-0.5'>
				<Rename
					machine={machine}
					fetcher={fetcher}
					state={renameState}
					magic={magic}
				/>
				<Delete
					machine={machine}
					fetcher={fetcher}
					state={removeState}
				/>
				{expired ? undefined : (
					<Expire
						machine={machine}
						fetcher={fetcher}
						state={expireState}
					/>
				)}
				<Routes
					machine={machine}
					routes={routes}
					fetcher={fetcher}
					state={routesState}
				/>

				<Menu>
					<Menu.Button
						className={cn(
							'flex items-center justify-center',
							'border border-transparent rounded-lg py-0.5 w-10',
							'group-hover:border-gray-200 dark:group-hover:border-zinc-700'
						)}
					>
						<KebabHorizontalIcon className='w-5'/>
					</Menu.Button>
					<Menu.Items>
						<Menu.ItemButton control={renameState}>
							Edit machine name
						</Menu.ItemButton>
						<Menu.ItemButton control={routesState}>
							Edit route settings
						</Menu.ItemButton>
						<Menu.Item className='opacity-50 hover:bg-transparent'>
							Edit ACL tags
						</Menu.Item>
						{expired ? undefined : (
							<Menu.ItemButton control={expireState}>
								Expire
							</Menu.ItemButton>
						)}
						<Menu.ItemButton
							className='text-red-500 dark:text-red-400'
							control={removeState}
						>
							Remove
						</Menu.ItemButton>
					</Menu.Items>
				</Menu>
			</td>
		</tr>
	)
}
