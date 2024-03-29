/* eslint-disable unicorn/filename-case */
import { ClipboardIcon } from '@heroicons/react/24/outline'
import { type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import clsx from 'clsx'
import { toast } from 'react-hot-toast/headless'

import StatusCircle from '~/components/StatusCircle'
import { type Machine } from '~/types'
import { pull } from '~/utils/headscale'
import { getSession } from '~/utils/sessions'
import { useLiveData } from '~/utils/useLiveData'

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))

	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const data = await pull<{ nodes: Machine[] }>('v1/node', session.get('hsApiKey')!)
	return data.nodes
}

export default function Page() {
	const data = useLoaderData<typeof loader>()
	useLiveData({ interval: 3000 })

	return (
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
						<tr key={machine.id} className='hover:bg-zinc-100 dark:hover:bg-zinc-800'>
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
						</tr>
					)
				})}
			</tbody>
		</table>
	)
}
