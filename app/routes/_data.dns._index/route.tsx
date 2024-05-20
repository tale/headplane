import { type ActionFunctionArgs } from '@remix-run/node'
import { json, useFetcher, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import { Button, Input } from 'react-aria-components'

import Code from '~/components/Code'
import Notice from '~/components/Notice'
import Spinner from '~/components/Spinner'
import Switch from '~/components/Switch'
import TableList from '~/components/TableList'
import { cn } from '~/utils/cn'
import { loadContext } from '~/utils/config/headplane'
import { loadConfig, patchConfig } from '~/utils/config/headscale'
import { restartHeadscale } from '~/utils/docker'
import { getSession } from '~/utils/sessions'
import { useLiveData } from '~/utils/useLiveData'

import Domains from './domains'
import MagicModal from './magic'
import RenameModal from './rename'

// We do not want to expose every config value
export async function loader() {
	const context = await loadContext()
	if (!context.config.read) {
		throw new Error('No configuration is available')
	}

	const config = await loadConfig()
	const dns = {
		prefixes: config.prefixes,
		magicDns: config.dns_config.magic_dns,
		baseDomain: config.dns_config.base_domain,
		overrideLocal: config.dns_config.override_local_dns,
		nameservers: config.dns_config.nameservers,
		splitDns: config.dns_config.restricted_nameservers,
		searchDomains: config.dns_config.domains,
		extraRecords: config.dns_config.extra_records,
	}

	return {
		...dns,
		...context,
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
	if (!context.config.write) {
		return json({ success: false }, {
			status: 403,
		})
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
		<div className="flex flex-col gap-16 max-w-screen-lg">
			{data.config.write
				? undefined
				: (
					<Notice>
						The Headscale configuration is read-only. You cannot make changes to the configuration
					</Notice>
					)}
			<RenameModal name={data.baseDomain} disabled={!data.config.write} />
			<div className="flex flex-col w-2/3">
				<h1 className="text-2xl font-medium mb-4">Nameservers</h1>
				<p className="text-gray-700 dark:text-gray-300">
					Set the nameservers used by devices on the Tailnet
					to resolve DNS queries.
				</p>
				<div className="mt-4">
					<div className="flex items-center justify-between mb-2">
						<h2 className="text-md font-medium opacity-80">
							Global Nameservers
						</h2>
						<div className="flex gap-2 items-center">
							<span className="text-sm opacity-50">
								Override local DNS
							</span>
							<Switch
								label="Override local DNS"
								defaultSelected={localOverride}
								isDisabled={!data.config.write}
								onChange={() => {
									fetcher.submit({
										// eslint-disable-next-line @typescript-eslint/naming-convention
										'dns_config.override_local_dns': !localOverride,
									}, {
										method: 'PATCH',
										encType: 'application/json',
									})

									setLocalOverride(!localOverride)
								}}
							/>
						</div>
					</div>
					<TableList>
						{data.nameservers.map((ns, index) => (
							// eslint-disable-next-line react/no-array-index-key
							<TableList.Item key={index}>
								<p className="font-mono text-sm">{ns}</p>
								<Button
									className={cn(
										'text-sm',
										'text-red-600 dark:text-red-400',
										'hover:text-red-700 dark:hover:text-red-300',
										!data.config.write && 'opacity-50 cursor-not-allowed',
									)}
									isDisabled={!data.config.write}
									onPress={() => {
										fetcher.submit({
											// eslint-disable-next-line @typescript-eslint/naming-convention
											'dns_config.nameservers': data.nameservers.filter((_, index_) => index_ !== index),
										}, {
											method: 'PATCH',
											encType: 'application/json',
										})
									}}
								>
									Remove
								</Button>
							</TableList.Item>
						))}
						{data.config.write
							? (
								<TableList.Item>
									<Input
										type="text"
										className="font-mono text-sm bg-transparent w-full mr-2"
										placeholder="Nameserver"
										value={ns}
										onChange={(event) => {
											setNs(event.target.value)
										}}
									/>
									{fetcher.state === 'idle'
										? (
											<Button
												className={cn(
													'text-sm font-semibold',
													'text-blue-600 dark:text-blue-400',
													'hover:text-blue-700 dark:hover:text-blue-300',
													ns.length === 0 && 'opacity-50 cursor-not-allowed',
												)}
												isDisabled={ns.length === 0}
												onPress={() => {
													fetcher.submit({
													// eslint-disable-next-line @typescript-eslint/naming-convention
														'dns_config.nameservers': [...data.nameservers, ns],
													}, {
														method: 'PATCH',
														encType: 'application/json',
													})

													setNs('')
												}}
											>
												Add
											</Button>
											)
										: (
											<Spinner className="w-3 h-3 mr-0" />
											)}
								</TableList.Item>
								)
							: undefined}
					</TableList>
					{/* TODO: Split DNS and Custom A Records */}
				</div>
			</div>

			<Domains
				baseDomain={data.magicDns ? data.baseDomain : undefined}
				searchDomains={data.searchDomains}
				disabled={!data.config.write}
			/>

			<div className="flex flex-col w-2/3">
				<h1 className="text-2xl font-medium mb-4">Magic DNS</h1>
				<p className="text-gray-700 dark:text-gray-300 mb-4">
					Automatically register domain names for each device
					on the tailnet. Devices will be accessible at
					{' '}
					<Code>
						[device].[user].
						{data.baseDomain}
					</Code>
					{' '}
					when Magic DNS is enabled.
				</p>
				<MagicModal isEnabled={data.magicDns} disabled={!data.config.write} />
			</div>
		</div>
	)
}
