import { Switch } from '@headlessui/react'
import { type ActionFunctionArgs } from '@remix-run/node'
import { json, useFetcher, useLoaderData } from '@remix-run/react'
import clsx from 'clsx'
import { useState } from 'react'

import Button from '~/components/Button'
import Code from '~/components/Code'
import Input from '~/components/Input'
import Notice from '~/components/Notice'
import Spinner from '~/components/Spinner'
import TableList from '~/components/TableList'
import { getConfig, getContext, patchConfig } from '~/utils/config'
import { restartHeadscale } from '~/utils/docker'
import { useLiveData } from '~/utils/useLiveData'

import Domains from './domains'
import MagicModal from './magic'
import RenameModal from './rename'

// We do not want to expose every config value
export async function loader() {
	const context = await getContext()
	if (!context.hasConfig) {
		throw new Error('No configuration is available')
	}

	const config = await getConfig()

	const dns = {
		prefixes: config.prefixes,
		magicDns: config.dns_config.magic_dns,
		baseDomain: config.dns_config.base_domain,
		overrideLocal: config.dns_config.override_local_dns,
		nameservers: config.dns_config.nameservers,
		splitDns: config.dns_config.restricted_nameservers,
		searchDomains: config.dns_config.domains,
		extraRecords: config.dns_config.extra_records
	}

	return {
		...dns,
		...context
	}
}

export async function action({ request }: ActionFunctionArgs) {
	const context = await getContext()
	if (!context.hasConfigWrite) {
		return json({ success: false })
	}

	const data = await request.json() as Record<string, unknown>
	await patchConfig(data)
	await restartHeadscale()
	return json({ success: true })
}

export default function Page() {
	useLiveData({ interval: 5000 })
	const data = useLoaderData<typeof loader>()
	const fetcher = useFetcher()
	const [localOverride, setLocalOverride] = useState(data.overrideLocal)
	const [ns, setNs] = useState('')

	return (
		<div className='flex flex-col gap-16 max-w-screen-lg'>
			{data.hasConfigWrite ? undefined : (
				<Notice>
					The Headscale configuration is read-only. You cannot make changes to the configuration
				</Notice>
			)}
			<RenameModal name={data.baseDomain} disabled={!data.hasConfigWrite}/>
			<div className='flex flex-col w-2/3'>
				<h1 className='text-2xl font-medium mb-4'>Nameservers</h1>
				<p className='text-gray-700 dark:text-gray-300'>
					Set the nameservers used by devices on the Tailnet
					to resolve DNS queries.
				</p>
				<div className='mt-4'>
					<div className='flex items-center justify-between mb-2'>
						<h2 className='text-md font-medium opacity-80'>
							Global Nameservers
						</h2>
						<div className='flex gap-2 items-center'>
							<span className='text-sm opacity-50'>
								Override local DNS
							</span>
							<Switch
								checked={localOverride}
								disabled={!data.hasConfigWrite}
								className={clsx(
									localOverride ? 'bg-gray-800 dark:bg-gray-600' : 'bg-gray-200 dark:bg-gray-400',
									'relative inline-flex h-4 w-9 items-center rounded-full'
								)}
								onChange={() => {
									fetcher.submit({
										// eslint-disable-next-line @typescript-eslint/naming-convention
										'dns_config.override_local_dns': !localOverride
									}, {
										method: 'PATCH',
										encType: 'application/json'
									})

									setLocalOverride(!localOverride)
								}}
							>
								<span className='sr-only'>Override local DNS</span>
								<span
									className={clsx(
										localOverride ? 'translate-x-6' : 'translate-x-1',
										'inline-block h-2 w-2 transform rounded-full bg-white transition'
									)}
								/>
							</Switch>
						</div>
					</div>
					<TableList>
						{data.nameservers.map((ns, index) => (
							// eslint-disable-next-line react/no-array-index-key
							<TableList.Item key={index}>
								<p className='font-mono text-sm'>{ns}</p>
								<Button
									variant='destructive'
									className='text-sm'
									disabled={!data.hasConfigWrite}
									onClick={() => {
										fetcher.submit({
											// eslint-disable-next-line @typescript-eslint/naming-convention
											'dns_config.nameservers': data.nameservers.filter((_, index_) => index_ !== index)
										}, {
											method: 'PATCH',
											encType: 'application/json'
										})
									}}
								>
									Remove
								</Button>
							</TableList.Item>
						))}
						{data.hasConfigWrite ? (
							<TableList.Item>
								<Input
									variant='embedded'
									type='text'
									className='font-mono text-sm'
									placeholder='Nameserver'
									value={ns}
									onChange={event => {
										setNs(event.target.value)
									}}
								/>
								{fetcher.state === 'idle' ? (
									<Button
										className='text-sm'
										disabled={ns.length === 0}
										onClick={() => {
											fetcher.submit({
												// eslint-disable-next-line @typescript-eslint/naming-convention
												'dns_config.nameservers': [...data.nameservers, ns]
											}, {
												method: 'PATCH',
												encType: 'application/json'
											})

											setNs('')
										}}
									>
										Add
									</Button>
								) : (
									<Spinner className='w-3 h-3 mr-0'/>
								)}
							</TableList.Item>
						) : undefined}
					</TableList>
					{/* TODO: Split DNS and Custom A Records */}
				</div>
			</div>

			<Domains
				baseDomain={data.magicDns ? data.baseDomain : undefined}
				searchDomains={data.searchDomains}
				disabled={!data.hasConfigWrite}
			/>

			<div className='flex flex-col w-2/3'>
				<h1 className='text-2xl font-medium mb-4'>Magic DNS</h1>
				<p className='text-gray-700 dark:text-gray-300 mb-4'>
					Automaticall register domain names for each device
					on the tailnet. Devices will be accessible at
					{' '}
					<Code>
						[device].[user].{data.baseDomain}
					</Code>
					{' '}
					when Magic DNS is enabled.
				</p>
				<MagicModal isEnabled={data.magicDns} disabled={!data.hasConfigWrite}/>
			</div>
		</div>
	)
}
