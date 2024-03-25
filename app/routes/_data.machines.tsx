import { ClipboardIcon } from '@heroicons/react/24/outline'
import { type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import clsx from 'clsx'
import { toast } from 'react-hot-toast/headless'

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
			<thead>
				<tr className='text-left'>
					<th className='pl-4'>Name</th>
					<th>IP Addresses</th>
					<th>Last Seen</th>
				</tr>
			</thead>
			<tbody className='divide-y divide-zinc-200 dark:divide-zinc-700'>
				{data.map(machine => (
					<tr key={machine.id} className='hover:bg-zinc-100 dark:hover:bg-zinc-800'>
						<td className='pt-2 pb-4 pl-4'>
							<a href={`machines/${machine.id}`}>
								<h1>{machine.givenName}</h1>
								<span
									className='text-sm font-mono text-gray-500 dark:text-gray-400'
								>{machine.name}
								</span
								>
							</a>
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
						<td>
							<span
								className='flex items-center gap-x-1 text-sm text-gray-500 dark:text-gray-400'
							>
								<svg
									className={clsx(
										'w-4 h-4',
										machine.online
											? 'text-green-700 dark:text-green-400'
											: 'text-gray-300 dark:text-gray-500'
									)}
									viewBox='0 0 24 24'
									fill='currentColor'
								>
									<circle cx='12' cy='12' r='8'/>
								</svg>
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
				))}
			</tbody>
		</table>
	)
}
