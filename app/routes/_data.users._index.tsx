/* eslint-disable unicorn/filename-case */
import { ClipboardIcon, UserIcon } from '@heroicons/react/24/outline'
import { type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { toast } from 'react-hot-toast/headless'

import Attribute from '~/components/Attribute'
import Card from '~/components/Card'
import StatusCircle from '~/components/StatusCircle'
import { type Machine, type User } from '~/types'
import { pull } from '~/utils/headscale'
import { getSession } from '~/utils/sessions'
import { useLiveData } from '~/utils/useLiveData'

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))

	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const data = await pull<{ nodes: Machine[] }>('v1/node', session.get('hsApiKey')!)

	const users = new Map<string, Machine[]>()
	for (const machine of data.nodes) {
		const { user } = machine
		if (!users.has(user.id)) {
			users.set(user.id, [])
		}

		users.get(user.id)?.push(machine)
	}

	return [...users.values()].map(machines => {
		const { user } = machines[0]

		return {
			...user,
			machines
		}
	})
}

export default function Page() {
	const data = useLoaderData<typeof loader>()
	useLiveData({ interval: 3000 })

	return (
		<div className='grid grid-cols-2 gap-4 auto-rows-min'>
			{data.map(user => (
				<Card key={user.id}>
					<div className='flex items-center gap-4'>
						<UserIcon className='w-6 h-6'/>
						<span className='text-lg font-mono'>
							{user.name}
						</span>
					</div>
					<div className='py-4'>
						{user.machines.map(machine => (
							<div key={machine.id} className='flex items-center w-full gap-4'>
								<StatusCircle isOnline={machine.online} className='w-4 h-4 px-1 w-fit'/>
								<Attribute name={`Node ${machine.id}`} value={machine.givenName}/>
							</div>
						))}
					</div>
				</Card>
			))}
		</div>
	)
}
