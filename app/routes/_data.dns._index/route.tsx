import { type ActionFunctionArgs } from '@remix-run/node'
import { json, useLoaderData } from '@remix-run/react'

import Code from '~/components/Code'
import Notice from '~/components/Notice'
import { loadContext } from '~/utils/config/headplane'
import { loadConfig, patchConfig } from '~/utils/config/headscale'
import { getSession } from '~/utils/sessions'
import { useLiveData } from '~/utils/useLiveData'

import DNS from './dns'
import Domains from './domains'
import MagicModal from './magic'
import Nameservers from './nameservers'
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

	if (context.integration?.onConfigChange) {
		await context.integration.onConfigChange(context.integration.context)
	}

	return json({ success: true })
}

export default function Page() {
	useLiveData({ interval: 5000 })
	const data = useLoaderData<typeof loader>()

	const allNs: Record<string, string[]> = {}
	for (const key of Object.keys(data.splitDns)) {
		allNs[key] = data.splitDns[key]
	}

	allNs.global = data.nameservers

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
			<Nameservers
				nameservers={allNs}
				override={data.overrideLocal}
				isDisabled={!data.config.write}
			/>

			<DNS
				records={data.extraRecords}
				isDisabled={!data.config.write}
			/>

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
