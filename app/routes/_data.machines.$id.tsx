import { type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'

import Attribute from '~/components/Attribute'
import Card from '~/components/Card'
import StatusCircle from '~/components/StatusCircle'
import { type Machine } from '~/types'
import { pull } from '~/utils/headscale'
import { getSession } from '~/utils/sessions'
import { useLiveData } from '~/utils/useLiveData'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	if (!params.id) {
		throw new Error('No machine ID provided')
	}

	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const data = await pull<{ node: Machine }>(`v1/node/${params.id}`, session.get('hsApiKey')!)
	return data.node
}

export default function Page() {
	const data = useLoaderData<typeof loader>()
	useLiveData({ interval: 1000 })

	return (
		<div>
			<p className='mb-4 text-gray-500 dark:text-gray-400 text-sm'>
				<Link
					to='/machines'
					className='font-bold text-gray-700 dark:text-gray-300 hover:underline'
				>
					All Machines
				</Link>
				{' / '}
				{data.givenName}
			</p>
			<span className='flex items-baseline gap-x-4 text-sm mb-4'>
				<h1 className='text-2xl font-bold'>
					{data.givenName}
				</h1>
				<StatusCircle isOnline={data.online} className='w-4 h-4'/>
			</span>
			<Card>
				<Attribute name='Creator' value={data.user.name}/>
				<Attribute name='Node ID' value={data.id}/>
				<Attribute name='Node Name' value={data.givenName}/>
				<Attribute name='Hostname' value={data.name}/>
				<Attribute
					isCopyable
					name='Node Key'
					value={data.nodeKey}
				/>
				<Attribute
					name='Created'
					value={new Date(data.createdAt).toLocaleString()}
				/>
				<Attribute
					name='Last Seen'
					value={new Date(data.lastSeen).toLocaleString()}
				/>
				<Attribute
					name='Expiry'
					value={new Date(data.expiry).toLocaleString()}
				/>
				<Attribute
					isCopyable
					name='Domain'
					value={`${data.givenName}.${data.user.name}.ts.net`}
				/>
			</Card>
		</div>
	)
}
