import { ChevronDownIcon, ClipboardIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { type FetcherWithComponents, Link } from '@remix-run/react'
import clsx from 'clsx'
import toast from 'react-hot-toast/headless'

import Dropdown from '~/components/Dropdown'
import type { OpenFunction } from '~/components/Modal'
import StatusCircle from '~/components/StatusCircle'
import { type Machine } from '~/types'

type MachineProperties = {
	readonly machine: Machine;
	readonly open: OpenFunction;
	readonly fetcher: FetcherWithComponents<unknown>;
	readonly magic?: string;
}

export default function MachineRow({ machine, open, fetcher, magic }: MachineProperties) {
	const tags = [...machine.forcedTags, ...machine.validTags]
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
					<p className={clsx(
						'font-semibold leading-snug',
						'group-hover/link:text-blue-600',
						'group-hover/link:dark:text-blue-400'
					)}
					>
						{machine.givenName}
					</p>
					<p className='text-sm text-gray-400 font-mono'>
						{machine.name}
					</p>
					<div className='flex gap-1 mt-1'>
						{tags.map(tag => (
							<span
								key={tag}
								className={clsx(
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
					<Dropdown
						width='w-max'
						button={(
							<ChevronDownIcon className='w-4 h-4'/>
						)}
					>
						{machine.ipAddresses.map(ip => (
							<Dropdown.Item key={ip}>
								<button
									type='button'
									className={clsx(
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
							</Dropdown.Item>
						))}
						{magic ? (
							<Dropdown.Item>
								<button
									type='button'
									className={clsx(
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
							</Dropdown.Item>
						) : undefined}
					</Dropdown>
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
				<div className={clsx(
					'border border-transparent rounded-lg py-0.5 w-10',
					'group-hover:border-gray-200 dark:group-hover:border-zinc-700'
				)}
				>
					<Dropdown
						className='left-1/4'
						width='w-48'
						button={(
							<EllipsisHorizontalIcon className='w-5 h-5'/>
						)}
					>
						<Dropdown.Item variant='static'>
							<button
								disabled
								type='button'
								className='text-left w-full opacity-50'
								onClick={() => {
									open()
								}}
							>
								Edit machine name
							</button>
						</Dropdown.Item>
						<Dropdown.Item variant='static'>
							<button
								disabled
								type='button'
								className='text-left w-full opacity-50'
								onClick={() => {
									open()
								}}
							>
								Edit route settings
							</button>
						</Dropdown.Item>
						<Dropdown.Item variant='static'>
							<button
								disabled
								type='button'
								className='text-left w-full opacity-50'
								onClick={() => {
									open()
								}}
							>
								Edit ACL tags
							</button>
						</Dropdown.Item>
						<Dropdown.Item>
							<button
								type='button'
								className='text-left text-red-700 w-full'
								onClick={() => {
									open({
										title: 'Remove Machine',
										description: [
											'This action is irreversible and will disconnect the machine from the Headscale server.',
											'All data associated with this machine including ACLs and tags will be lost.'
										].join('\n'),
										variant: 'danger',
										buttonText: 'Remove',
										onConfirm: () => {
											fetcher.submit(
												{
													id: machine.id
												},
												{
													method: 'DELETE',
													encType: 'application/json'
												}
											)
										}
									})
								}}
							>
								Remove
							</button>
						</Dropdown.Item>
					</Dropdown>
				</div>
			</td>
		</tr>
	)
}
