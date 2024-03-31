/* eslint-disable unicorn/filename-case */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ClipboardIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useFetcher, useLoaderData } from '@remix-run/react'
import clsx from 'clsx'
import { useState } from 'react'
import { toast } from 'react-hot-toast/headless'

import Dropdown from '~/components/Dropdown'
import useModal from '~/components/Modal'
import StatusCircle from '~/components/StatusCircle'
import { type Machine } from '~/types'
import { del, pull } from '~/utils/headscale'
import { getSession } from '~/utils/sessions'
import { useLiveData } from '~/utils/useLiveData'

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))

	const data = await pull<{ nodes: Machine[] }>('v1/node', session.get('hsApiKey')!)
	return data.nodes
}

export async function action({ request }: ActionFunctionArgs) {
	const data = await request.json() as { id?: string }
	if (!data.id) {
		return json({ message: 'No ID provided' }, {
			status: 400
		})
	}

	const session = await getSession(request.headers.get('Cookie'))
	if (!session.has('hsApiKey')) {
		return json({ message: 'Unauthorized' }, {
			status: 401
		})
	}

	await del(`v1/node/${data.id}`, session.get('hsApiKey')!)
	return json({ message: 'Machine removed' })
}

export default function Page() {
	useLiveData({ interval: 3000 })
	const data = useLoaderData<typeof loader>()
	const fetcher = useFetcher()

	const { Modal, open } = useModal()

	return (
		<>
			{Modal}
			<table className='table-auto w-full rounded-lg'>
				<thead className='text-gray-500 dark:text-gray-400'>
					<tr className='text-left uppercase text-sm font-bold'>
						<th className='pl-4'>Name</th>
						<th>IP Addresses</th>
						<th>Last Seen</th>
					</tr>
				</thead>
				<tbody className={clsx(
					'divide-y divide-zinc-200 dark:divide-zinc-700 align-top',
					'border-t border-zinc-200 dark:border-zinc-700'
				)}
				>
					{data.map(machine => {
						const tags = [...machine.forcedTags, ...machine.validTags]
						return (
							<tr key={machine.id} className='hover:bg-zinc-100 dark:hover:bg-zinc-800 group'>
								<td className='py-2 pl-4'>
									<Link to={`/machines/${machine.id}`}>
										<h1>{machine.givenName}</h1>
										<span className='text-sm font-mono text-gray-500 dark:text-gray-400'>
											{machine.name}
										</span>
										<div className='flex gap-1 mt-1'>
											{tags.map(tag => (
												<span key={tag} className='text-xs bg-gray-200 text-gray-600 rounded-sm px-1 py-0.5'>
													{tag}
												</span>
											))}
										</div>
									</Link>
								</td>
								<td className='pt-2 pb-4 font-mono text-gray-600 dark:text-gray-300'>
									{machine.ipAddresses.map((ip, index) => (
										<button
											key={ip}
											type='button'
											className='flex items-center gap-x-1 w-full'
											onClick={async () => {
												await navigator.clipboard.writeText(ip)
												toast('Copied IP address to clipboard')
											}}
										>
											<span className={clsx(index === 0 ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500')}>
												{ip}
											</span>
											<ClipboardIcon className='text-gray-400 dark:text-gray-500 w-4 h-4'/>
										</button>
									))}
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
								<td className='py-2 pr-4'>
									<div className={clsx(
										'border border-transparent rounded-lg py-0.5 w-10',
										'group-hover:border-gray-200 dark:group-hover:border-zinc-700'
									)}
									>
										<Dropdown
											className='left-1/4 cursor-pointer'
											width='w-48'
											button={(
												<EllipsisHorizontalIcon className='w-5 h-5'/>
											)}
										>
											<Dropdown.Item>
												<button
													type='button'
													className='text-left'
													onClick={() => {
														open()
													}}
												>
													Edit machine name
												</button>
											</Dropdown.Item>
											<Dropdown.Item>
												<button
													type='button'
													className='text-left'
													onClick={() => {
														open()
													}}
												>
													Edit route settings
												</button>
											</Dropdown.Item>
											<Dropdown.Item>
												<button
													type='button'
													className='text-left'
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
													className='text-left text-red-700'
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
					})}
				</tbody>
			</table>
		</>
	)
}
