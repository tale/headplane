import { Tab } from '@headlessui/react'
import { BeakerIcon, CubeTransparentIcon, EyeIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { type ActionFunctionArgs, json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import clsx from 'clsx'
import { useState } from 'react'
import { Fragment } from 'react/jsx-runtime'
import { ClientOnly } from 'remix-utils/client-only'

import Notice from '~/components/Notice'
import { getAcl, getContext, patchAcl } from '~/utils/config'
import { sighupHeadscale } from '~/utils/docker'
import { getSession } from '~/utils/sessions'

import Editor from './editor'

export async function loader() {
	const context = await getContext()
	if (!context.hasAcl) {
		throw new Error('No ACL configuration is available')
	}

	const { data, type } = await getAcl()
	return {
		hasAclWrite: context.hasAclWrite,
		currentAcl: data,
		aclType: type
	}
}

export async function action({ request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	if (!session.has('hsApiKey')) {
		return json({ success: false }, {
			status: 401
		})
	}

	const context = await getContext()
	if (!context.hasAclWrite) {
		return json({ success: false }, {
			status: 403
		})
	}

	const data = await request.json() as { acl: string }
	await patchAcl(data.acl)
	await sighupHeadscale()
	return json({ success: true })
}

export default function Page() {
	const data = useLoaderData<typeof loader>()
	const [acl, setAcl] = useState(data.currentAcl)

	return (
		<div className='mx-16'>
			{data.hasAclWrite ? undefined : (
				<div className='mb-4'>
					<Notice>
						The ACL policy file is readonly to Headplane.
						You will not be able to make changes here.
					</Notice>
				</div>
			)}

			<h1 className='text-2xl font-medium mb-4'>
				Access Control List (ACL)
			</h1>

			<p className='mb-4 max-w-prose'>
				The ACL file is used to define the access control rules for your network.
				You can find more information about the ACL file in the Tailscale documentation.
				{' '}
				<a
					target='_blank'
					rel='noreferrer'
					href='https://tailscale.com/kb/1018/acls'
					className='text-blue-500 dark:text-blue-400 hover:underline'
				>
					More information
				</a>
			</p>

			<Tab.Group>
				<Tab.List className={clsx(
					'flex border-t border-gray-200 dark:border-gray-700',
					'w-fit rounded-t-lg overflow-hidden',
					'text-gray-400 dark:text-gray-500'
				)}
				>
					<Tab as={Fragment}>
						{({ selected }) => (
							<button
								type='button'
								className={clsx(
									'px-4 py-2 rounded-tl-lg',
									'focus:outline-none flex items-center gap-2',
									'border-l border-gray-200 dark:border-gray-700',
									selected ? 'text-gray-900 dark:text-gray-100' : ''
								)}
							>
								<PencilSquareIcon className='w-5 h-5'/>
								<p>
									Edit file
								</p>
							</button>
						)}
					</Tab>
					<Tab as={Fragment}>
						{({ selected }) => (
							<button
								type='button'
								className={clsx(
									'px-4 py-2',
									'focus:outline-none flex items-center gap-2',
									'border-x border-gray-200 dark:border-gray-700',
									selected ? 'text-gray-900 dark:text-gray-100' : ''
								)}
							>
								<EyeIcon className='w-5 h-5'/>
								<p>
									Preview changes
								</p>
							</button>
						)}
					</Tab>
					<Tab as={Fragment}>
						{({ selected }) => (
							<button
								type='button'
								className={clsx(
									'px-4 py-2 rounded-tr-lg',
									'focus:outline-none flex items-center gap-2',
									'border-r border-gray-200 dark:border-gray-700',
									selected ? 'text-gray-900 dark:text-gray-100' : ''
								)}
							>
								<BeakerIcon className='w-5 h-5'/>
								<p>
									Preview rules
								</p>
							</button>
						)}
					</Tab>
				</Tab.List>
				<Tab.Panels>
					<Tab.Panel>
						<ClientOnly>
							{() => (
								<Editor data={data} acl={acl} setAcl={setAcl} mode='edit'/>
							)}
						</ClientOnly>
					</Tab.Panel>
					<Tab.Panel>
						<ClientOnly>
							{() => (
								<Editor data={data} acl={acl} setAcl={setAcl} mode='diff'/>
							)}
						</ClientOnly>
					</Tab.Panel>
					<Tab.Panel>
						<div
							className={clsx(
								'border border-gray-200 dark:border-gray-700',
								'rounded-b-lg rounded-tr-lg mb-4 overflow-hidden',
								'p-16 flex flex-col items-center justify-center'
							)}
						>
							<CubeTransparentIcon className='w-24 h-24 text-gray-300 dark:text-gray-500'/>
							<p className='w-1/2 text-center mt-4'>
								The Preview rules is very much still a work in progress.
								It's a bit complicated to implement right now but hopefully it will be available soon.
							</p>
						</div>
					</Tab.Panel>
				</Tab.Panels>
			</Tab.Group>
		</div>
	)
}
