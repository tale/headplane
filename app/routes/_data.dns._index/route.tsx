import { Switch } from '@headlessui/react'
import { useLoaderData } from '@remix-run/react'
import clsx from 'clsx'
import { useState } from 'react'

import { getConfig } from '~/utils/config'

import RenameModal from './rename'

// We do not want to expose every config value
export async function loader() {
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

	return dns
}

export default function Page() {
	const data = useLoaderData<typeof loader>()
	const [localOverride, setLocalOverride] = useState(data.overrideLocal)

	return (
		<div className='flex flex-col gap-16'>
			<div className='flex flex-col w-2/3'>
				<h1 className='text-2xl font-medium mb-4'>Tailnet Name</h1>
				<p className='text-gray-700 dark:text-gray-300'>
					This is the base domain name of your Tailnet.
					Devices are accessible at
					{' '}
					<code className='bg-gray-100 p-1 rounded-md'>
						[device].[user].{data.baseDomain}
					</code>
					{' '}
					when Magic DNS is enabled.
				</p>
				<input
					readOnly
					className='my-4 px-3 py-2 border rounded-lg focus:ring-none w-2/3 font-mono text-sm'
					type='text'
					value={data.baseDomain}
					onFocus={event => {
						event.target.select()
					}}
				/>
				<RenameModal/>
			</div>
			<div className='flex flex-col w-2/3'>
				<h1 className='text-2xl font-medium mb-4'>Nameservers</h1>
				<p className='text-gray-700 dark:text-gray-300'>
					Set the nameservers used by devices on the Tailnet
					to resolve DNS queries.
				</p>
				<div className='my-8'>
					<div className='flex items-center justify-between mb-2'>
						<h2 className='text-md font-medium opacity-80'>
							Global Nameservers
						</h2>
						<div className='flex gap-2 items-center'>
							<span className='text-sm opacity-50'>Override local DNS</span>
							<Switch
								checked={localOverride}
								className={clsx(
									localOverride ? 'bg-gray-800' : 'bg-gray-200',
									'relative inline-flex h-4 w-9 items-center rounded-full'
								)}
								onChange={() => {
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
					<div className='border border-gray-200 rounded-lg bg-gray-50'>
						{data.nameservers.map((ns, index) => (
							<div
								// eslint-disable-next-line react/no-array-index-key
								key={index}
								className={clsx(
									'flex items-center justify-between px-3 py-2',
									'border-b border-gray-200 last:border-b-0'
								)}
							>
								<p className='font-mono text-sm'>{ns}</p>
								<button
									type='button'
									className='text-sm text-red-700'
								>
									Remove
								</button>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
