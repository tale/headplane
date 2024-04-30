/* eslint-disable react/hook-use-state */
import { ChevronDownIcon, ClipboardIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { type FetcherWithComponents, Link } from '@remix-run/react'
import { useState } from 'react'
import toast from 'react-hot-toast/headless'

import Dialog from '~/components/Dialog'
import Menu from '~/components/Menu'
import StatusCircle from '~/components/StatusCircle'
import { type Machine } from '~/types'
import { cn } from '~/utils/cn'

import Delete from './dialogs/delete'
import Rename from './dialogs/rename'

type MachineProperties = {
	readonly machine: Machine;
	readonly fetcher: FetcherWithComponents<unknown>;
	readonly magic?: string;
}

export default function MachineRow({ machine, fetcher, magic }: MachineProperties) {
	const tags = [...machine.forcedTags, ...machine.validTags]
	const renameState = useState(false)
	const removeState = useState(false)

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
								<Menu.Item
									key={ip}
									className='hover:bg-transparent'
								>
									<button
										type='button'
										className={cn(
											'flex items-center gap-x-1.5 text-sm',
											'justify-between w-full'
										)}
										onClick={async () => {
											await navigator.clipboard.writeText(ip)
											toast('Copied IP address to clipboard')
										}}
									>
										{ip}
										<ClipboardIcon className='w-3 h-3'/>
									</button>
								</Menu.Item>
							))}
							{magic ? (
								<Menu.Item className='hover:bg-transparent'>
									<button
										type='button'
										className={cn(
											'flex items-center gap-x-1.5 text-sm',
											'justify-between w-full break-keep'
										)}
										onClick={async () => {
											const ip = `${machine.givenName}.${machine.user.name}.${magic}`
											await navigator.clipboard.writeText(ip)
											toast('Copied hostname to clipboard')
										}}
									>
										{machine.givenName}.{machine.user.name}.{magic}
										<ClipboardIcon className='w-3 h-3'/>
									</button>
								</Menu.Item>
							) : undefined}
						</Menu.Items>
					</Menu>
				</div>
			</td>
			<td className='py-2'>
				<span
					className='flex items-center gap-x-1 text-sm text-gray-500 dark:text-gray-400'
				>
					<StatusCircle isOnline={machine.online} className='w-4 h-4'/>
					<p>
						{machine.online
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
				<Menu>
					<Menu.Button
						className={cn(
							'flex items-center justify-center',
							'border border-transparent rounded-lg py-0.5 w-10',
							'group-hover:border-gray-200 dark:group-hover:border-zinc-700'
						)}
					>
						<EllipsisHorizontalIcon className='w-5'/>
					</Menu.Button>
					<Menu.Items>
						<Menu.Item>
							<Dialog.Button
								className='h-full w-full text-left'
								control={renameState}
							>
								Edit machine name
							</Dialog.Button>
						</Menu.Item>
						<Menu.Item>
							Edit route settings
						</Menu.Item>
						<Menu.Item>
							Edit ACL tags
						</Menu.Item>
						<Menu.Item>
							<Dialog.Button
								className='w-full h-full text-left text-red-500 dark:text-red-400'
								control={removeState}
							>
								Remove
							</Dialog.Button>
						</Menu.Item>
					</Menu.Items>
				</Menu>
			</td>
		</tr>
	)
}
