
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import clsx from 'clsx'
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components'

import Code from '~/components/Code'
import useModal from '~/components/Modal'
import { type Machine } from '~/types'
import { getConfig, getContext } from '~/utils/config'
import { del, pull } from '~/utils/headscale'
import { getSession } from '~/utils/sessions'
import { useLiveData } from '~/utils/useLiveData'

import MachineRow from './machine'

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))

	const data = await pull<{ nodes: Machine[] }>('v1/node', session.get('hsApiKey')!)
	const context = await getContext()

	let magic: string | undefined
	if (context.hasConfig) {
		const config = await getConfig()
		if (config.dns_config.magic_dns) {
			magic = config.dns_config.base_domain
		}
	}

	return {
		nodes: data.nodes,
		magic
	}
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
			<h1 className='text-2xl font-medium mb-4'>Machines</h1>
			<table className='table-auto w-full rounded-lg'>
				<thead className='text-gray-500 dark:text-gray-400'>
					<tr className='text-left uppercase text-xs font-bold px-0.5'>
						<th className='pb-2'>Name</th>
						<th className='pb-2'>
							<div className='flex items-center gap-x-1'>
								Addresses
								{data.magic ? (
									<TooltipTrigger delay={0}>
										<Button>
											<InformationCircleIcon className='w-4 h-4 text-gray-400'/>
										</Button>
										<Tooltip className={clsx(
											'text-sm max-w-xs p-2 rounded-lg mb-2',
											'bg-white dark:bg-zinc-800',
											'border border-gray-200 dark:border-zinc-700'
										)}
										>
											Since MagicDNS is enabled, you can access devices
											based on their name and also at
											{' '}
											<Code>
												[name].[user].{data.magic}
											</Code>
										</Tooltip>
									</TooltipTrigger>
								) : undefined}
							</div>
						</th>
						<th className='pb-2'>Last Seen</th>
					</tr>
				</thead>
				<tbody className={clsx(
					'divide-y divide-zinc-200 dark:divide-zinc-700 align-top',
					'border-t border-zinc-200 dark:border-zinc-700'
				)}
				>
					{data.nodes.map(machine => (
						<MachineRow
							key={machine.id}
							// Typescript isn't smart enough yet
							machine={machine as unknown as Machine}
							fetcher={fetcher}
							open={open}
							magic={data.magic}
						/>
					))}
				</tbody>
			</table>
		</>
	)
}
