import { BeakerIcon, EyeIcon, IssueDraftIcon, PencilIcon } from '@primer/octicons-react'
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, useRevalidator } from '@remix-run/react'
import { useDebounceFetcher } from 'remix-utils/use-debounce-fetcher'
import { useEffect, useState, useMemo } from 'react'
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
import { loadConfig } from '~/utils/config/headscale'
import { HeadscaleError, pull, put } from '~/utils/headscale'
import { getSession } from '~/utils/sessions'
import { send } from '~/utils/res'
import log from '~/utils/log'

import { Editor, Differ } from './components/cm.client'
import { Unavailable } from './components/unavailable'
import { ErrorView } from './components/error'

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	
	// The way policy is handled in 0.23 of Headscale and later is verbose.
	// The 2 ACL policy modes are either the database one or file one
	//
	// File: The ACL policy is readonly to the API and manually edited
	// Database: The ACL policy is read/write to the API
	//
	// To determine if we first have an ACL policy available we need to check
	// if fetching the v1/policy route gives us a 500 status code or a 200.
	//
	// 500 can mean many different things here unfortunately:
	// - In file based that means the file is not accessible
	// - In database mode this can mean that we have never set an ACL policy
	// - In database mode this can mean that the ACL policy is not available
	// - A general server error may have occurred
	//
	// Unfortunately the server errors are not very descriptive so we have to
	// do some silly guesswork here. If we are running in an integration mode
	// and have the Headscale configuration available to us, our assumptions
	// can be more accurate, otherwise we just HAVE to assume that the ACL
	// policy has never been set.
	//
	// We can do damage control by checking for write access and if we are not
	// able to PUT an ACL policy on the v1/policy route, we can already know
	// that the policy is at the very-least readonly or not available.
	const context = await loadContext()
	let modeGuess = 'database' // Assume database mode
	if (context.config.read) {
		const config = await loadConfig()
		modeGuess = config.policy?.mode ?? 'database'
	}

	// Attempt to load the policy, for both the frontend and for checking
	// if we are able to write to the policy for write access
	try {
		const { policy } = await pull<{ policy: string }>(
			'v1/policy',
			session.get('hsApiKey')!,
		)

		let write = false // On file mode we already know it's readonly
		if (modeGuess === 'database' && policy.length > 0) {
			try {
				await put('v1/policy', session.get('hsApiKey')!, {
					policy: policy,
				})

				write = true
			} catch (error) {
				write = false
				log.debug(
					'APIC',
					'Failed to write to ACL policy with error %s',
					error
				)
			}
		}

		return {
			read: true,
			write,
			mode: modeGuess,
			policy
		}
	} catch {
		// If we are explicit on file mode then this is the end of the road
		if (modeGuess === 'file') {
			return {
				read: false,
				write: false,
				mode: modeGuess,
				policy: null
			}
		}

		// Assume that we have write access otherwise?
		// This is sort of a brittle assumption to make but we don't want
		// to create a default policy if we don't have to.
		return {
			read: true,
			write: true,
			mode: modeGuess,
			policy: null
		}
	}
}

export async function action({ request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	if (!session.has('hsApiKey')) {
		return send({ success: false, error: null }, 401)
	}

	try {
		const { acl } = await request.json() as { acl: string }
		const { policy } = await put<{ policy: string }>(
			'v1/policy',
			session.get('hsApiKey')!,
			{
				policy: acl,
			}
		)

		return { success: true, policy, error: null }
	} catch (error) {
		log.debug('APIC', 'Failed to update ACL policy with error %s', error)

		// @ts-ignore: Shut UP we know it's a string most of the time
		const text = JSON.parse(error.message)
		return send({ success: false, error: text.message }, {
			status: error instanceof HeadscaleError ? error.status : 500,
		})
	}

	return { success: true, error: null }
}

export default function Page() {
	const data = useLoaderData<typeof loader>()
	const fetcher = useDebounceFetcher<typeof action>()
	const revalidator = useRevalidator()

	const [acl, setAcl] = useState(data.policy ?? '')
	const [toasted, setToasted] = useState(false)

	useEffect(() => {
		if (!fetcher.data || toasted) {
			return
		}

		// @ts-ignore: useDebounceFetcher is not typed correctly
		if (fetcher.data.success) {
			toast('Updated tailnet ACL policy')
		} else {
			toast('Failed to update tailnet ACL policy')
		}

		setToasted(true)
		if (revalidator.state === 'idle') {
			revalidator.revalidate()
		}
	}, [fetcher.data, toasted, data.policy])

	// The state for if the save and discard buttons should be disabled
	// is pretty complicated to calculate and varies on different states.
	const disabled = useMemo(() => {
		if (!data.read || !data.write) {
			return true
		}

		// First check our fetcher states
		if (fetcher.state === 'loading') {
			return true
		}

		if (revalidator.state === 'loading') {
			return true
		}

		// If we have a failed fetcher state allow the user to try again
		// @ts-ignore: useDebounceFetcher is not typed correctly
		if (fetcher.data?.success === false) {
			return false
		}

		return data.policy === acl
	}, [data, revalidator.state, fetcher.state, fetcher.data, data.policy, acl])

	return (
		<div>
			{data.read && !data.write
				? (
					<div className="mb-4">
						<Notice className="w-fit">
							The ACL policy is read-only. You can view the current policy
							but you cannot make changes to it.
							<br />
							To resolve this, you need to set the ACL policy mode to
							database in your Headscale configuration.
						</Notice>
					</div>
				) : undefined}

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
					to="https://headscale.net/stable/ref/acls/"
					name="Headscale ACL documentation"
				>
					Headscale docs
				</Link>
				.
			</p>

			{
				// @ts-ignore: useDebounceFetcher is not typed correctly
				fetcher.data?.success === false
				? (
					// @ts-ignore: useDebounceFetcher is not typed correctly
					<ErrorView message={fetcher.data.error} />
				) : undefined}

			{data.read ? (
				<>
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
								isDisabled={!data.write}
								value={acl}
								onChange={setAcl}
							/>
						</TabPanel>
						<TabPanel id="diff">
							<Differ
								left={data?.policy ?? ''}
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
						isDisabled={disabled}
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
						isDisabled={disabled}
						onPress={() => {
							setAcl(data?.policy ?? '')
						}}
					>
						Discard Changes
					</Button>
				</>
			) : <Unavailable mode={data.mode as "database" | "file"} />}
		</div>
	)
}
