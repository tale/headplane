/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BeakerIcon, EyeIcon, IssueDraftIcon, PencilIcon } from '@primer/octicons-react'
import { ActionFunctionArgs, json, LoaderFunctionArgs } from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components'
import { setTimeout } from 'node:timers/promises'

import Button from '~/components/Button'
import Code from '~/components/Code'
import Link from '~/components/Link'
import Notice from '~/components/Notice'
import Spinner from '~/components/Spinner'
import { toast } from '~/components/Toaster'
import { cn } from '~/utils/cn'
import { loadContext } from '~/utils/config/headplane'
import { HeadscaleError, pull, put } from '~/utils/headscale'
import { getSession } from '~/utils/sessions'

import { Editor, Differ } from './cm'

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))

	try {
		const { policy } = await pull<{ policy: string }>(
			'v1/policy',
			session.get('hsApiKey')!,
		)

		try {
			// We have read access, now do we have write access?
			// Attempt to set the policy to what we just got
			await put('v1/policy', session.get('hsApiKey')!, {
				policy,
			})

			return {
				hasAclWrite: true,
				currentAcl: policy,
				aclType: 'json',
			} as const
		} catch (error) {
			if (!(error instanceof HeadscaleError)) {
				throw error
			}

			if (error.status === 500) {
				return {
					hasAclWrite: false,
					currentAcl: policy,
					aclType: 'json',
				} as const
			}
		}
	} catch {}

	return {
		hasAclWrite: true,
		currentAcl: '',
		aclType: 'json',
	} as const
}

export async function action({ request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	if (!session.has('hsApiKey')) {
		return json({ success: false }, {
			status: 401,
		})
	}

	const { acl } = await request.json() as { acl: string, api: boolean }
	try {
		await put('v1/policy', session.get('hsApiKey')!, {
			policy: acl,
		})

		await setTimeout(250)
		return json({ success: true })
	} catch (error) {
		return json({ success: false }, {
			status: error instanceof HeadscaleError ? error.status : 500,
		})
	}

	return json({ success: true })
}

export function ErrorBoundary() {
	return (
		<div>
			<Notice className="mb-4">
				An ACL policy is not available or an error occurred while trying to fetch it.
			</Notice>
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
			<div>
				<div className="max-w-prose">
					<p className="mb-4 text-md">
						If you are running Headscale 0.23-beta1 or later, the
						ACL configuration is most likely set to
						{' '}
						<Code>file</Code>
						{' '}
						mode but the ACL file is not available. In order to
						resolve this you will either need to correctly set
						{' '}
						<Code>policy.path</Code>
						{' '}
						in your Headscale configuration or set the
						{' '}
						<Code>policy.mode</Code>
						{' '}
						to
						{' '}
						<Code>database</Code>
						.
					</p>
				</div>
			</div>
		</div>
	)
}

export default function Page() {
	const data = useLoaderData<typeof loader>()
	const fetcher = useFetcher<typeof action>()
	const [acl, setAcl] = useState(data.currentAcl)
	const [toasted, setToasted] = useState(false)

	useEffect(() => {
		if (!fetcher.data || toasted) {
			return
		}

		if (fetcher.data.success) {
			toast('Updated tailnet ACL policy')
		} else {
			toast('Failed to update tailnet ACL policy')
		}

		setToasted(true)
		setAcl(data.currentAcl)
	}, [fetcher.data, toasted, data.currentAcl])

	return (
		<div>
			{data.hasAclWrite
				? undefined
				: (
					<div className="mb-4">
						<Notice className="w-fit">
							The ACL policy is read-only. You can view the current policy
							but you cannot make changes to it.
							<br />
							To resolve this, you need to set the ACL policy mode to
							database in your Headscale configuration.
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
					<Editor
						isDisabled={!data.hasAclWrite}
						defaultValue={data.currentAcl}
						onChange={setAcl}
					/>
				</TabPanel>
				<TabPanel id="diff">
					<Differ
						left={data.currentAcl}
						right={acl}
					/>
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
			<Button
				variant="heavy"
				className="mr-2"
				isDisabled={fetcher.state === 'loading' || !data.hasAclWrite || data.currentAcl === acl}
				onPress={() => {
					setToasted(false)
					fetcher.submit({
						acl,
					}, {
						method: 'PATCH',
						encType: 'application/json',
					})
				}}
			>
				{fetcher.state === 'idle'
					? undefined
					: (
						<Spinner className="w-3 h-3" />
						)}
				Save
			</Button>
			<Button
				isDisabled={fetcher.state === 'loading' || data.currentAcl === acl || !data.hasAclWrite}
				onPress={() => { setAcl(data.currentAcl) }}
			>
				Discard Changes
			</Button>
		</div>
	)
}
