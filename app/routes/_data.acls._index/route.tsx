import { BeakerIcon, EyeIcon, IssueDraftIcon, PencilIcon } from '@primer/octicons-react'
import { type ActionFunctionArgs, json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components'
import { ClientOnly } from 'remix-utils/client-only'

import Link from '~/components/Link'
import Notice from '~/components/Notice'
import { cn } from '~/utils/cn'
import { loadAcl, loadContext, patchAcl } from '~/utils/config/headplane'
import { sighupHeadscale } from '~/utils/docker'
import { getSession } from '~/utils/sessions'

import Editor from './editor'
import Fallback from './fallback'

export async function loader() {
	const context = await loadContext()
	if (!context.acl.read) {
		throw new Error('No ACL configuration is available')
	}

	const { data, type } = await loadAcl()
	return {
		hasAclWrite: context.acl.write,
		currentAcl: data,
		aclType: type,
	}
}

export async function action({ request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	if (!session.has('hsApiKey')) {
		return json({ success: false }, {
			status: 401,
		})
	}

	const context = await loadContext()
	if (!context.acl.write) {
		return json({ success: false }, {
			status: 403,
		})
	}

	const data = await request.json() as { acl: string }
	await patchAcl(data.acl)

	if (context.docker) {
		await sighupHeadscale()
	}

	return json({ success: true })
}

export default function Page() {
	const data = useLoaderData<typeof loader>()
	const [acl, setAcl] = useState(data.currentAcl)

	return (
		<div>
			{data.hasAclWrite
				? undefined
				: (
					<div className="mb-4">
						<Notice>
							The ACL policy file is readonly to Headplane.
							You will not be able to make changes here.
						</Notice>
					</div>
					)}

			<h1 className="text-2xl font-medium mb-4">
				Access Control List (ACL)
			</h1>

			<p className="mb-4 max-w-prose">
				The ACL file is used to define the access control rules for your network.
				You can find more information about the ACL file in the
				{' '}
				<Link
					to="https://tailscale.com/kb/1018/acls"
					name="Tailscale ACL documentation"
				>
					Tailscale ACL guide
				</Link>
				{' '}
				and the
				{' '}
				<Link
					to="https://headscale.net/acls"
					name="Headscale ACL documentation"
				>
					Headscale docs
				</Link>
				.
			</p>

			<Tabs>
				<TabList className={cn(
					'flex border-t border-gray-200 dark:border-gray-700',
					'w-fit rounded-t-lg overflow-hidden',
					'text-gray-400 dark:text-gray-500',
				)}
				>
					<Tab
						id="edit"
						className={({ isSelected }) => cn(
							'px-4 py-2 rounded-tl-lg',
							'focus:outline-none flex items-center gap-2',
							'border-x border-gray-200 dark:border-gray-700',
							isSelected ? 'text-gray-900 dark:text-gray-100' : '',
						)}
					>
						<PencilIcon className="w-5 h-5" />
						<p>Edit file</p>
					</Tab>
					<Tab
						id="diff"
						className={({ isSelected }) => cn(
							'px-4 py-2',
							'focus:outline-none flex items-center gap-2',
							'border-x border-gray-200 dark:border-gray-700',
							isSelected ? 'text-gray-900 dark:text-gray-100' : '',
						)}
					>
						<EyeIcon className="w-5 h-5" />
						<p>Preview changes</p>
					</Tab>
					<Tab
						id="preview"
						className={({ isSelected }) => cn(
							'px-4 py-2 rounded-tr-lg',
							'focus:outline-none flex items-center gap-2',
							'border-x border-gray-200 dark:border-gray-700',
							isSelected ? 'text-gray-900 dark:text-gray-100' : '',
						)}
					>
						<BeakerIcon className="w-5 h-5" />
						<p>Preview rules</p>
					</Tab>
				</TabList>
				<TabPanel id="edit">
					<ClientOnly fallback={<Fallback acl={acl} where="server" />}>
						{() => (
							<Editor data={data} acl={acl} setAcl={setAcl} mode="edit" />
						)}
					</ClientOnly>
				</TabPanel>
				<TabPanel id="diff">
					<ClientOnly fallback={<Fallback acl={acl} where="server" />}>
						{() => (
							<Editor data={data} acl={acl} setAcl={setAcl} mode="diff" />
						)}
					</ClientOnly>
				</TabPanel>
				<TabPanel id="preview">
					<div
						className={cn(
							'border border-gray-200 dark:border-gray-700',
							'rounded-b-lg rounded-tr-lg mb-4 overflow-hidden',
							'p-16 flex flex-col items-center justify-center',
						)}
					>
						<IssueDraftIcon className="w-24 h-24 text-gray-300 dark:text-gray-500" />
						<p className="w-1/2 text-center mt-4">
							The Preview rules is very much still a work in progress.
							It is a bit complicated to implement right now but hopefully it will be available soon.
						</p>
					</div>
				</TabPanel>
			</Tabs>
		</div>
	)
}
